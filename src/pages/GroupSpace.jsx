import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../api';
import { QRCodeSVG } from 'qrcode.react';
import { UploadCloud, Check, ArrowRight, RotateCcw, Trash2, Mic, Receipt, Wallet, Copy } from 'lucide-react';

const GroupSpace = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'upload', 'assignment', 'payment'
  const [loadingMsg, setLoadingMsg] = useState('');

  // Active Bill States
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);
  const [itemAssignments, setItemAssignments] = useState({});
  const [paidBy, setPaidBy] = useState('');
  const [systemQuota, setSystemQuota] = useState({ exceeded: false, resetTime: null });

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    fetchGroup();
    setupVoice();
    checkSystemQuota();
  }, [id]);

  const checkSystemQuota = async () => {
    try {
      const res = await apiFetch('/api/system/status');
      if (res.ok) {
         const data = await res.json();
         setSystemQuota({ exceeded: data.quotaExceeded, resetTime: data.resetTime });
      }
    } catch(e) {}
  };

  const fetchGroup = async () => {
    try {
      const res = await apiFetch(`/api/groups/${id}`);
      if (!res.ok) {
        navigate('/dashboard');
        return;
      }
      const data = await res.json();
      setGroup(data);
    } catch (e) {
      navigate('/dashboard');
    }
  };

  const setupVoice = () => {
    if ('webkitSpeechRecognition' in window) {
      const rec = new window.webkitSpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTrans += event.results[i][0].transcript;
          else interimTrans += event.results[i][0].transcript;
        }
        setTranscript(finalTrans || interimTrans || "Listening...");
        if (finalTrans) {
          rec.stop();
          processVoiceCommand(finalTrans);
        }
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  };

  const processVoiceCommand = async (text) => {
    setIsListening(false);
    setLoadingMsg("Gemini is parsing intent...");
    try {
      const res = await apiFetch('/api/voice', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      const intent = await res.json();
      if (intent.action === 'split_item' && intent.item) {
        const item = items.find(i => i.name.toLowerCase().includes(intent.item.toLowerCase()));
        if (item) {
          let newAssignments = { ...itemAssignments };
          if (typeof intent.users === 'number') {
            newAssignments[item.id] = group.members.slice(0, intent.users).map(p => p.id);
          } else if (Array.isArray(intent.users)) {
            let pids = [];
            intent.users.forEach(u => {
              const person = group.members.find(p => p.name.toLowerCase().includes(u.toLowerCase()));
              if (person) pids.push(person.id);
            });
            if (pids.length > 0) newAssignments[item.id] = pids;
          }
          setItemAssignments(newAssignments);
        }
      }
    } catch (e) {} finally { setLoadingMsg(''); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingMsg("Gemini AI analyzing receipt...");
    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const response = await apiFetch('/api/scan', { method: 'POST', body: formData });
      if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || "Error parsing receipt");
      }
      const data = await response.json();
      
      setItems(data.items.map(i => ({ ...i, id: Math.random().toString() })));
      let st = data.subtotal || 0, tt = data.total || 0, tx = data.tax || 0;
      if (tt === 0) {
        st = data.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        tt = st + tx;
      }
      setSubtotal(st); setTax(tx); setTotal(tt); setItemAssignments({});
      setPaidBy(user.id);
      setView('assignment');
    } catch (err) {
      alert(err.message || "Error parsing receipt");
      checkSystemQuota();
    } finally {
      setLoadingMsg('');
    }
  };

  const toggleAssignment = (itemId, personId) => {
    setItemAssignments(prev => {
      const current = prev[itemId] || [];
      return current.includes(personId) 
        ? { ...prev, [itemId]: current.filter(id => id !== personId) } 
        : { ...prev, [itemId]: [...current, personId] };
    });
  };

  const deleteTrip = async () => {
    if (!window.confirm("Are you sure you want to delete this trip permanently?")) return;
    try {
      await apiFetch(`/api/groups/${id}`, { method: 'DELETE' });
      navigate('/dashboard');
    } catch(e) { alert("Failed to delete"); }
  };

  const saveBillToTrip = async () => {
    const unassignedCount = items.filter(i => !(itemAssignments[i.id] && itemAssignments[i.id].length > 0)).length;
    if (unassignedCount > 0 && !window.confirm(`${unassignedCount} items are unassigned. Continue anyway?`)) return;

    try {
      await apiFetch('/api/bills/save', {
        method: 'POST',
        body: JSON.stringify({
          group_id: id,
          items,
          subtotal,
          tax,
          total,
          itemAssignments,
          paid_by: paidBy
        })
      });
      setItems([]); setSubtotal(0); setTax(0); setTotal(0); setItemAssignments({});
      await fetchGroup();
      setView('dashboard');
    } catch(e) {
      alert("Failed to save bill");
    }
  };

  const calculateSplit = () => {
    if (!group || !group.bills) return [];
    
    const debts = {}; // "from_to" -> { from Person, to Person, amount, bills: [] }

    group.bills.forEach(bill => {
      if (!bill.paid_by) return; // Skip old bills without payee
      
      let assignedTotal = 0;
      const userCosts = {};
      
      Object.keys(bill.itemAssignments).forEach(itemId => {
        const assignees = bill.itemAssignments[itemId];
        if (assignees.length > 0) {
          const item = bill.items.find(i => i.id === itemId);
          if (item) {
            const splitCost = item.price / assignees.length;
            assignees.forEach(pid => {
              userCosts[pid] = (userCosts[pid] || 0) + splitCost;
              assignedTotal += splitCost;
            });
          }
        }
      });

      const taxRatio = bill.tax / (assignedTotal || 1);
      Object.keys(bill.itemAssignments).forEach(itemId => {
        const assignees = bill.itemAssignments[itemId];
        const item = bill.items.find(i => i.id === itemId);
        if (item && assignees.length > 0) {
          const taxCost = (item.price / assignees.length) * taxRatio;
          assignees.forEach(pid => {
            userCosts[pid] = (userCosts[pid] || 0) + taxCost;
          });
        }
      });

      const userPayments = {};
      if (bill.payments) {
          bill.payments.forEach(pay => {
              userPayments[pay.user_id] = (userPayments[pay.user_id] || 0) + pay.amount;
          });
      }

      Object.keys(userCosts).forEach(pid => {
          if (pid !== bill.paid_by) {
              const remainingOwed = userCosts[pid] - (userPayments[pid] || 0);
              if (remainingOwed > 0.01) {
                  const key = `${pid}_${bill.paid_by}`;
                  if (!debts[key]) {
                      const fromPerson = group.members.find(m => m.id === pid);
                      const toPerson = group.members.find(m => m.id === bill.paid_by);
                      if(fromPerson && toPerson) {
                         debts[key] = { from: fromPerson, to: toPerson, amount: 0, bills: [] };
                      }
                  }
                  if (debts[key]) {
                      debts[key].amount += remainingOwed;
                      debts[key].bills.push({ bill_id: bill._id, amount: remainingOwed });
                  }
              }
          }
      });
    });

    return Object.values(debts);
  };

  const markAsPaid = async (debtBills) => {
    try {
        await apiFetch('/api/bills/pay', {
            method: 'POST',
            body: JSON.stringify({
                payments: debtBills
            })
        });
        await fetchGroup();
    } catch(e) {}
  };

  if (!group) return null;

  const splitResults = view === 'payment' ? calculateSplit() : [];

  return (
    <div className="flex-1 container mx-auto px-4 py-8 max-w-5xl relative z-10">
      
      {view === 'dashboard' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="flex justify-between items-center bg-black/60 glassmorphism p-6 rounded-2xl border border-primary/30">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Active Operation</p>
              <div className="flex items-center gap-3">
                 <h2 className="text-3xl font-bold text-neon-orange uppercase tracking-wider">{group.name}</h2>
                 <button onClick={() => { navigator.clipboard.writeText(group._id); alert("Access ID Copied!"); }} className="text-muted-foreground hover:text-white" title="Copy Access ID">
                   <Copy className="w-5 h-5"/>
                 </button>
                 {group.created_by === user.id && (
                    <button onClick={deleteTrip} className="text-red-500/70 hover:text-red-500 ml-2" title="Delete Trip">
                      <Trash2 className="w-5 h-5"/>
                    </button>
                 )}
              </div>
            </div>
            <button onClick={() => setView('upload')} className="inline-flex items-center justify-center rounded-md font-bold border border-primary bg-primary/20 text-primary hover:bg-primary/40 hover:text-neon-orange transition-all shadow-[0_0_10px_rgba(255,100,0,0.2)] hover:shadow-[0_0_20px_rgba(255,100,0,0.5)] h-12 px-8 uppercase text-sm">
              <UploadCloud className="w-5 h-5 mr-2" /> Upload Protocol
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-lg font-semibold text-neon-amber">Crew Manifest</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {group.members.map(person => (
                  <div key={person.id} className="p-4 rounded-xl border border-border/50 bg-card/40 glassmorphism flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${person.color || 'bg-blue-500'} text-white flex items-center justify-center font-bold text-lg shadow-[0_0_10px_rgba(255,255,255,0.2)]`}>
                        {person.name.charAt(0)}
                      </div>
                      <p className="font-bold">{person.name} {person.id === user.id ? '(You)' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="md:col-span-1 space-y-4">
              <h3 className="text-lg font-semibold text-neon-orange">Captured Stubs</h3>
              <div className="space-y-3 min-h-[200px] border border-primary/30 rounded-xl p-4 bg-black/60 glassmorphism relative">
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-xl"></div>
                {group.bills.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center pt-8">No receipts processed.</p>
                ) : (
                  group.bills.map((bill, index) => (
                    <div key={bill._id} className="p-3 rounded-lg border border-primary/40 bg-black/80 flex justify-between items-center shadow-[0_0_10px_rgba(255,100,0,0.1)]">
                      <div>
                        <p className="font-bold text-sm">Receipt #{index + 1}</p>
                        <p className="text-xs text-muted-foreground">Paid by: {group.members.find(m => m.id === bill.paid_by)?.name || 'Unknown'}</p>
                      </div>
                      <p className="font-bold text-neon-orange">₹{bill.total.toFixed(2)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {group.bills.length > 0 && (
            <div className="flex justify-center mt-12 mb-8">
              <button onClick={() => setView('payment')} className="inline-flex items-center justify-center rounded-md font-medium border border-secondary bg-secondary/20 text-secondary hover:bg-secondary/40 hover:text-neon-amber hover:shadow-[0_0_20px_rgba(255,166,0,0.6)] transition-all h-14 px-12 text-lg uppercase tracking-wider relative overflow-hidden group">
                <span className="absolute inset-0 bg-secondary/10 group-hover:animate-pulse"></span>
                <Wallet className="w-6 h-6 mr-3 relative z-10" /> <span className="relative z-10 font-bold">Calculate Payments</span>
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'upload' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in zoom-in duration-500">
           {systemQuota.exceeded ? (
             <div className="w-full max-w-md mx-auto relative group text-center bg-black/60 glassmorphism p-8 rounded-xl border border-red-500/50">
               <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <RotateCcw className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-bold text-red-400 uppercase tracking-widest mb-2">AI Quota Exceeded</h3>
               <p className="text-muted-foreground mb-4">You have reached the server's generative AI limit. Uploads are temporarily locked.</p>
               <p className="text-sm font-mono text-neon-orange bg-black/50 p-3 rounded-lg border border-primary/30">
                 Next available processing time:<br/>
                 {new Date(systemQuota.resetTime).toLocaleString()}
               </p>
             </div>
           ) : (
             <div className="w-full max-w-md mx-auto relative group">
               <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-primary/50 bg-black/60 rounded-xl cursor-pointer glassmorphism">
                 <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center space-y-4">
                   <div className="p-4 bg-primary/10 rounded-full group-hover:scale-110 transition-transform duration-300 shadow-[0_0_20px_rgba(255,100,0,0.2)] group-hover:shadow-[0_0_30px_rgba(255,100,0,0.6)]">
                     <UploadCloud className="w-10 h-10 text-primary" />
                   </div>
                   <div>
                     <p className="mb-2 text-sm font-bold text-foreground">
                       <span className="text-primary hover:text-neon-orange transition-colors">Click to upload</span> or drag and drop
                     </p>
                     <p className="text-xs text-muted-foreground">PNG, JPG, JPEG (Max 10MB)</p>
                   </div>
                 </div>
                 <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
               </label>
             </div>
           )}
           <button onClick={() => setView('dashboard')} className="text-muted-foreground hover:text-white uppercase text-xs tracking-widest">Cancel</button>
        </div>
      )}

      {view === 'assignment' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="flex justify-between items-center mb-8 bg-black/40 p-4 border border-border/50 rounded-lg flex-wrap gap-4">
            <h2 className="text-xl font-bold text-neon-orange uppercase tracking-wider">Assign Current Bill</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-border rounded-md px-3 py-1 bg-black/50">
                <span className="text-xs text-muted-foreground mr-2 font-bold uppercase tracking-widest hidden sm:inline">Paid By:</span>
                <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="bg-transparent text-sm font-bold text-foreground focus:outline-none appearance-none cursor-pointer">
                  {group.members.map(m => (
                    <option key={m.id} value={m.id} className="bg-gray-900">{m.name}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => { setTranscript("Listening..."); setIsListening(true); recognitionRef.current?.start(); }} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-secondary text-secondary bg-secondary/10 hover:bg-secondary/20 hover:text-neon-amber transition-all shadow-[0_0_10px_rgba(255,166,0,0.2)] h-9 px-4 py-2">
                <Mic className="w-4 h-4 mr-2" /> Assign via Voice
              </button>
            </div>
          </div>

          <div className="space-y-3 border border-primary/30 rounded-xl p-6 bg-black/60 glassmorphism relative max-w-3xl mx-auto">
            {items.map(item => {
              const assignedTo = itemAssignments[item.id] || [];
              return (
                <div key={item.id} className={`p-4 rounded-lg border transition-all duration-300 ${assignedTo.length > 0 ? 'bg-black/80 border-border/50' : 'bg-black/90 border-primary/60 shadow-[0_0_10px_rgba(255,100,0,0.2)]'}`}>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div>
                      <p className="font-bold text-lg">{item.name} <span className="text-xs text-muted-foreground ml-1">x{item.quantity}</span></p>
                      <p className="text-sm text-neon-amber font-mono mt-1">₹{item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.members.map(person => {
                        const isAssigned = assignedTo.includes(person.id);
                        return (
                          <button key={person.id} onClick={() => toggleAssignment(item.id, person.id)} className={`text-xs px-3 py-2 rounded-lg font-bold border transition-all flex items-center gap-1 ${isAssigned ? `${person.color || 'bg-blue-500'} text-white border-transparent` : 'bg-black/50 border-border text-muted-foreground hover:border-primary'}`}>
                            {isAssigned && <Check className="w-3 h-3" />} {person.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex flex-col md:flex-row justify-center gap-4 mt-8">
             <button onClick={() => setView('dashboard')} className="border border-border text-foreground bg-black/50 hover:bg-black w-full md:w-auto h-12 px-8 uppercase font-bold rounded-lg transition-colors">Discard</button>
             <button onClick={saveBillToTrip} className="w-full md:w-auto inline-flex items-center justify-center rounded-lg font-bold border border-primary bg-primary/20 text-primary hover:bg-primary/40 hover:text-neon-orange hover:shadow-[0_0_20px_rgba(255,100,0,0.6)] transition-all h-12 px-12 text-lg uppercase tracking-wider">
                Confirm & Save <Check className="w-5 h-5 ml-3" />
             </button>
          </div>
        </div>
      )}

      {view === 'payment' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="text-center space-y-4 mb-12">
             <div className="mx-auto w-16 h-16 border-2 border-secondary bg-secondary/10 text-secondary shadow-[0_0_20px_rgba(255,166,0,0.4)] rounded-full flex items-center justify-center mb-4">
               <Wallet className="w-8 h-8" />
             </div>
             <h2 className="text-4xl font-bold text-neon-amber uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,166,0,0.5)]">Debt Resolution</h2>
             <p className="text-muted-foreground">Settle outstanding balances directly via UPI interface.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
             {splitResults.length > 0 ? splitResults.map((debt, index) => {
               const isOwedByMe = debt.from.id === user.id;
               const isOwedToMe = debt.to.id === user.id;
               
               const upiLink = `upi://pay?pa=merchant@upi&pn=SmartSplit&am=${debt.amount.toFixed(2)}`;
               return (
                 <div key={index} className={`border ${isOwedByMe ? 'border-secondary/60 shadow-[0_0_15px_rgba(255,166,0,0.15)]' : 'border-primary/30'} rounded-2xl p-6 bg-black/60 glassmorphism relative overflow-hidden group`}>
                   <div className="flex justify-between items-start mb-6 border-b border-border/50 pb-6">
                     <div className="flex items-center gap-3">
                       <div className={`w-12 h-12 rounded-full ${debt.from.color || 'bg-blue-500'} text-white flex items-center justify-center font-bold text-2xl`}>
                         {debt.from.name.charAt(0)}
                       </div>
                       <div>
                         {isOwedByMe ? (
                           <h3 className="text-xl font-bold text-secondary">You owe {debt.to.name.split(' ')[0]}</h3>
                         ) : isOwedToMe ? (
                           <h3 className="text-xl font-bold text-neon-orange">{debt.from.name.split(' ')[0]} owes you</h3>
                         ) : (
                           <h3 className="text-xl font-bold">{debt.from.name.split(' ')[0]} owes {debt.to.name.split(' ')[0]}</h3>
                         )}
                         <span className="text-xs text-muted-foreground border border-muted-foreground/30 px-2 rounded-full mt-1 inline-block">Pending Action</span>
                       </div>
                     </div>
                     <div className="text-right">
                       <p className="text-xs text-muted-foreground uppercase tracking-widest">Amount</p>
                       <p className={`text-2xl font-bold ${isOwedByMe ? 'text-secondary' : 'text-neon-orange'} tracking-tight`}>₹{debt.amount.toFixed(2)}</p>
                     </div>
                   </div>

                   {isOwedByMe && (
                     <div className="flex flex-col items-center pt-2">
                       <div className="bg-white p-3 rounded-xl mb-4">
                         <QRCodeSVG value={upiLink} size={130} />
                       </div>
                       <a href={upiLink} target="_blank" rel="noreferrer" className="w-full text-center py-3 rounded-lg font-bold border border-secondary bg-secondary/20 text-secondary hover:bg-secondary/40 transition-colors uppercase tracking-widest mb-3">
                         <Check className="w-4 h-4 inline mr-2" /> Pay via UPI
                       </a>
                       <button onClick={() => markAsPaid(debt.bills)} className="text-xs text-muted-foreground hover:text-white underline uppercase">Bypass / Mark Paid Manually</button>
                     </div>
                   )}
                   
                   {!isOwedByMe && (
                     <div className="text-center py-6 text-muted-foreground text-sm">
                        Waiting for {debt.from.name} to clear this debt to {debt.to.name}.
                     </div>
                   )}
                 </div>
               );
             }) : <p className="col-span-2 text-center text-muted-foreground">All debts are cleared!</p>}
          </div>

          <div className="flex justify-center mt-12 pb-12">
             <button onClick={() => setView('dashboard')} className="inline-flex items-center justify-center rounded-lg font-bold border border-border bg-black/50 hover:bg-black transition-colors h-10 px-8 uppercase text-sm">
               Return to Dashboard
             </button>
          </div>
        </div>
      )}

      {/* Overlays */}
      {isListening && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
           <div className="p-8 rounded-2xl glassmorphism flex flex-col items-center space-y-6 max-w-md w-full text-center border-secondary">
             <div className="w-20 h-20 bg-secondary/10 border-2 border-secondary rounded-full flex items-center justify-center relative shadow-[0_0_30px_rgba(255,166,0,0.5)]">
               <Mic className="w-10 h-10 text-secondary relative z-10 animate-pulse" />
             </div>
             <p className="text-lg text-secondary/80 min-h-[60px] font-mono tracking-tighter">"{transcript}"</p>
           </div>
        </div>
      )}
      
      {loadingMsg && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-60 flex flex-col items-center justify-center animate-in fade-in duration-200">
           <div className="w-16 h-16 border-4 border-primary border-t-transparent shadow-[0_0_15px_rgba(255,100,0,0.5)] rounded-full animate-spin"></div>
           <p className="mt-6 font-bold text-neon-orange uppercase tracking-widest animate-pulse">{loadingMsg}</p>
        </div>
      )}
    </div>
  );
};

export default GroupSpace;
