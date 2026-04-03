import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      if (!res.ok) {
        let errData = {};
        try {
          errData = await res.json();
        } catch (e) {
          throw new Error('Server Error: Database connection failed or API is offline.');
        }
        throw new Error(errData.detail || 'Signup failed');
      }
      // On success, redirect to login
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(255,166,0,0.5)] text-secondary">
          <UserPlus className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold text-neon-amber uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,166,0,0.6)]">
          Initialize Profile
        </h1>
      </div>

      <div className="w-full max-w-md p-8 border border-secondary/30 rounded-2xl bg-black/60 glassmorphism relative shadow-[0_0_30px_rgba(255,166,0,0.1)]">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-secondary/50 rounded-tl-2xl"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-secondary/50 rounded-br-2xl"></div>

        {error && <div className="p-3 mb-6 border border-red-500/50 bg-red-500/10 text-red-400 text-sm rounded-lg text-center">{error}</div>}

        <form onSubmit={handleSignup} className="space-y-6 relative z-10">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Display Name</label>
            <input 
              type="text" 
              required
              className="w-full bg-black/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-black/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Passcode</label>
            <input 
              type="password" 
              required
              className="w-full bg-black/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button type="submit" className="w-full py-4 mt-4 inline-flex items-center justify-center rounded-lg font-bold border border-secondary bg-secondary/20 text-secondary hover:bg-secondary/40 hover:text-neon-amber hover:shadow-[0_0_20px_rgba(255,166,0,0.6)] transition-all uppercase tracking-wider">
            Register Target
          </button>
        </form>

        <div className="mt-6 text-center z-10 relative">
          <p className="text-sm text-muted-foreground">
            Already verified? <Link to="/login" className="text-neon-orange hover:underline hover:text-neon-orange transition-colors">Access Terminal</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
