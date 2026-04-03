from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
import google.generativeai as genai
import os
import json
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

from api.database import db
from api.auth_utils import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from api.models import UserSignup, UserLogin, GroupCreate, GroupJoin, BillSave
import jwt
from bson import ObjectId
from datetime import datetime, timedelta

from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="SmartSplit AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    user["_id"] = str(user["_id"])
    return user

# AUTHENTICATION
@app.post("/auth/signup")
async def signup(user: UserSignup):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(user.password)
    new_user = {
        "name": user.name,
        "email": user.email,
        "password": hashed_password
    }
    result = await db.users.insert_one(new_user)
    return {"id": str(result.inserted_id), "message": "User created successfully"}

@app.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["email"], "name": user["name"], "id": str(user["_id"])})
    return {"access_token": access_token, "token_type": "bearer"}


# GROUPS
@app.post("/api/groups/create")
async def create_group(group: GroupCreate, current_user: dict = Depends(get_current_user)):
    new_group = {
        "name": group.name,
        "members": [{"id": current_user["_id"], "name": current_user["name"], "color": "bg-blue-500"}],
        "created_by": current_user["_id"]
    }
    result = await db.groups.insert_one(new_group)
    return {"group_id": str(result.inserted_id), "name": group.name, "message": "Group created"}

@app.post("/api/groups/join")
async def join_group(payload: GroupJoin, current_user: dict = Depends(get_current_user)):
    try:
        group = await db.groups.find_one({"_id": ObjectId(payload.group_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid Group ID format")
        
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    # Check if already in group
    for member in group["members"]:
        if member["id"] == current_user["_id"]:
            return {"message": "Already a member", "group_id": payload.group_id}
            
    # Assign random color
    colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500']
    import random
    new_color = random.choice(colors)
    
    await db.groups.update_one(
        {"_id": ObjectId(payload.group_id)},
        {"$push": {"members": {"id": current_user["_id"], "name": current_user["name"], "color": new_color}}}
    )
    return {"message": "Joined group successfully", "group_id": payload.group_id}

@app.get("/api/user/groups")
async def get_user_groups(current_user: dict = Depends(get_current_user)):
    # Find groups where this user is a member
    cursor = db.groups.find({"members.id": current_user["_id"]})
    groups = []
    async for g in cursor:
        g["_id"] = str(g["_id"])
        groups.append(g)
    return {"groups": groups}

@app.delete("/api/groups/{group_id}")
async def delete_group(group_id: str, current_user: dict = Depends(get_current_user)):
    try:
        group = await db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
            
        if group.get("created_by") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Unauthorized to delete")
            
        await db.groups.delete_one({"_id": ObjectId(group_id)})
        await db.bills.delete_many({"group_id": group_id})
        return {"message": "Group deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/groups/{group_id}")
async def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    try:
        group = await db.groups.find_one({"_id": ObjectId(group_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid Group ID format")
        
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    bills_cursor = db.bills.find({"group_id": group_id})
    bills = []
    async for b in bills_cursor:
        b["_id"] = str(b["_id"])
        bills.append(b)
        
    group["_id"] = str(group["_id"])
    group["bills"] = bills
    return group

# BILLS
@app.post("/api/bills/save")
async def save_bill(bill: BillSave, current_user: dict = Depends(get_current_user)):
    new_bill = bill.model_dump()
    new_bill["created_by"] = current_user["_id"]
    new_bill["payments"] = [] # To track mark-paid
    result = await db.bills.insert_one(new_bill)
    return {"bill_id": str(result.inserted_id), "message": "Bill saved successfully"}

@app.post("/api/bills/pay")
async def pay_bill(payload: dict, current_user: dict = Depends(get_current_user)):
    payments = payload.get("payments", [])
    if "bill_id" in payload:
        payments.append({"bill_id": payload.get("bill_id"), "amount": payload.get("amount")})
        
    for p in payments:
        try:
            await db.bills.update_one(
                {"_id": ObjectId(p["bill_id"])},
                {"$push": {"payments": {"user_id": current_user["_id"], "amount": p["amount"], "status": "paid"}}}
            )
        except Exception:
            pass
    return {"message": "Payments recorded"}

# EXISTING AI ENDPOINTS
class VoiceRequest(BaseModel):
    text: str

@app.post("/api/scan")
async def scan_receipt(receipt: UploadFile = File(...)):
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing. Please set GEMINI_API_KEY in .env")
        
    try:
        image_data = await receipt.read()
        
        prompt = """
        You are an AI that extracts structured data from restaurant receipts. Identify item names, quantities, and final prices. Ignore GST, totals, and irrelevant lines. Return ONLY valid JSON.
        Expected response format:
        {
          "items": [
            {
              "name": "Paneer Dosa",
              "quantity": 2,
              "price": 118
            }
          ],
          "subtotal": 118,
          "tax": 0,
          "total": 118
        }
        """
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        parts = [{"mime_type": receipt.content_type, "data": image_data}, prompt]
        response = model.generate_content(parts)
        text_resp = response.text.strip()
        
        import re
        match = re.search(r'\{.*\}', text_resp, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        else:
            raise ValueError(f"Could not extract JSON from response: {text_resp}")
            
    except Exception as e:
        error_str = str(e).lower()
        if "quota" in error_str or "429" in error_str or "exhausted" in error_str or "403" in error_str:
            reset_time = datetime.utcnow() + timedelta(hours=24)
            await db.system_settings.update_one(
                {"_id": "api_quota"}, 
                {"$set": {"quota_exceeded": True, "reset_time": reset_time.isoformat()}}, 
                upsert=True
            )
            raise HTTPException(status_code=429, detail=f"API Quota Exceeded. Please try again later.")
        print(f"Error parsing receipt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voice")
async def parse_voice(request: VoiceRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing")
        
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"""
        You are an intent parser for a bill splitting app. Convert user commands into structured JSON actions.
        User says: "{request.text}"
        Return ONLY valid JSON.
        """
        response = model.generate_content(prompt)
        text_resp = response.text.strip()
        if text_resp.startswith("```json"): text_resp = text_resp[7:]
        if text_resp.startswith("```"): text_resp = text_resp[3:]
        if text_resp.endswith("```"): text_resp = text_resp[:-3]
        return json.loads(text_resp.strip())
    except Exception as e:
        error_str = str(e).lower()
        if "quota" in error_str or "429" in error_str or "exhausted" in error_str or "403" in error_str:
            reset_time = datetime.utcnow() + timedelta(hours=24)
            await db.system_settings.update_one(
                {"_id": "api_quota"}, 
                {"$set": {"quota_exceeded": True, "reset_time": reset_time.isoformat()}}, 
                upsert=True
            )
            raise HTTPException(status_code=429, detail=f"API Quota Exceeded. Please try again later.")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system/status")
async def get_system_status():
    quota_doc = await db.system_settings.find_one({"_id": "api_quota"})
    if quota_doc and quota_doc.get("quota_exceeded"):
        try:
            reset_time = datetime.fromisoformat(quota_doc["reset_time"])
            if datetime.utcnow() > reset_time:
                await db.system_settings.update_one({"_id": "api_quota"}, {"$set": {"quota_exceeded": False}})
                return {"quotaExceeded": False}
            return {
                "quotaExceeded": True,
                "resetTime": quota_doc["reset_time"]
            }
        except Exception:
            pass
    return {"quotaExceeded": False}
