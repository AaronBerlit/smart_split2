import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Sparkles } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      if (!res.ok) {
        throw new Error('Invalid credentials');
      }
      const data = await res.json();
      login(data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(255,100,0,0.5)] text-primary">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold text-neon-orange uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,100,0,0.6)]">
          System Login
        </h1>
      </div>

      <div className="w-full max-w-md p-8 border border-primary/30 rounded-2xl bg-black/60 glassmorphism relative shadow-[0_0_30px_rgba(255,100,0,0.1)]">
        {/* Decorative corner accents */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary/50 rounded-tr-2xl"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary/50 rounded-bl-2xl"></div>

        {error && <div className="p-3 mb-6 border border-red-500/50 bg-red-500/10 text-red-400 text-sm rounded-lg text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Email Hash</label>
            <input 
              type="email" 
              required
              className="w-full bg-black/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Passcode</label>
            <input 
              type="password" 
              required
              className="w-full bg-black/50 border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button type="submit" className="w-full py-4 mt-4 inline-flex items-center justify-center rounded-lg font-bold border border-primary bg-primary/20 text-primary hover:bg-primary/40 hover:text-neon-orange hover:shadow-[0_0_20px_rgba(255,100,0,0.6)] transition-all uppercase tracking-wider">
            Authenticate
          </button>
        </form>

        <div className="mt-6 text-center z-10 relative">
          <p className="text-sm text-muted-foreground">
            No active profile? <Link to="/signup" className="text-neon-amber hover:underline hover:text-neon-orange transition-colors">Initialize account</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
