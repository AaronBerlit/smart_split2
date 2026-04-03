from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class UserSignup(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class GroupCreate(BaseModel):
    name: str

class GroupJoin(BaseModel):
    group_id: str

class BillSave(BaseModel):
    group_id: str
    items: List[Dict[str, Any]]
    subtotal: float
    tax: float
    total: float
    itemAssignments: Dict[str, List[str]]
    paid_by: str
