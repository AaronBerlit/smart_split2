import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../api';
import { Users, Plus, LogIn, ArrowRight } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinId, setJoinId] = useState('');
  const [createName, setCreateName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await apiFetch('/api/user/groups');
      const data = await res.json();
      if (res.ok) setGroups(data.groups || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!createName) return;
    try {
      const res = await apiFetch('/api/groups/create', {
        method: 'POST',
        body: JSON.stringify({ name: createName })
      });
      const data = await res.json();
      if (res.ok) navigate(`/group/${data.group_id}`);
    } catch (e) {
      alert("Error creating group");
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinId) return;
    try {
      const res = await apiFetch('/api/groups/join', {
        method: 'POST',
        body: JSON.stringify({ group_id: joinId })
      });
      if (res.ok) {
        navigate(`/group/${joinId}`);
      } else {
        const err = await res.json();
        alert(err.detail || "Error joining group");
      }
    } catch (e) {
      alert("Error joining group");
    }
  };

  if (loading) return null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl animate-in slide-in-from-bottom-8 fade-in duration-500">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-bold text-neon-orange uppercase tracking-wider">Command Center</h1>
          <p className="text-muted-foreground">Welcome back, {user?.name}</p>
        </div>
        <button onClick={logout} className="text-sm border border-border px-4 py-2 hover:border-red-500 hover:text-red-500 transition-colors uppercase tracking-widest text-xs">
          Disconnect
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <form onSubmit={handleCreateGroup} className="p-6 border border-primary/30 rounded-xl bg-black/60 glassmorphism shadow-[0_0_20px_rgba(255,100,0,0.05)] hover:border-primary/60 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/20 rounded-lg text-primary"><Plus className="w-5 h-5"/></div>
            <h2 className="text-xl font-bold text-neon-orange">Establish New Trip</h2>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Operation Name..." 
              className="flex-1 bg-black/50 border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
            <button type="submit" className="px-6 rounded-lg font-bold border border-primary bg-primary/20 text-primary hover:bg-primary/40 hover:text-neon-orange hover:shadow-[0_0_15px_rgba(255,100,0,0.4)] transition-all uppercase">
              Launch
            </button>
          </div>
        </form>

        <form onSubmit={handleJoinGroup} className="p-6 border border-secondary/30 rounded-xl bg-black/60 glassmorphism shadow-[0_0_20px_rgba(255,166,0,0.05)] hover:border-secondary/60 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-secondary/20 rounded-lg text-secondary"><LogIn className="w-5 h-5"/></div>
            <h2 className="text-xl font-bold text-neon-amber">Join Active Trip</h2>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Paste Access ID..." 
              className="flex-1 bg-black/50 border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
            />
            <button type="submit" className="px-6 rounded-lg font-bold border border-secondary bg-secondary/20 text-secondary hover:bg-secondary/40 hover:text-neon-amber hover:shadow-[0_0_15px_rgba(255,166,0,0.4)] transition-all uppercase">
              Link
            </button>
          </div>
        </form>
      </div>

      <div>
        <h3 className="text-xl font-bold text-foreground mb-4 uppercase tracking-widest border-b border-border/50 pb-2">Active Protocols</h3>
        {groups.length === 0 ? (
          <p className="text-muted-foreground text-center py-12 border border-dashed border-border rounded-xl">No active trips found on your scanner.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(g => (
              <button 
                key={g._id} 
                onClick={() => navigate(`/group/${g._id}`)}
                className="text-left p-5 border border-border/60 rounded-xl bg-black/40 glassmorphism hover:border-primary hover:bg-black/60 transition-all group flex flex-col justify-between"
              >
                <div>
                  <h4 className="font-bold text-lg text-primary group-hover:text-neon-orange drop-shadow-none group-hover:drop-shadow-[0_0_5px_rgba(255,100,0,0.8)] transition-all">{g.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">ID: {g._id}</p>
                </div>
                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Users className="w-3 h-3 mr-1" /> {g.members?.length || 0} crew
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
