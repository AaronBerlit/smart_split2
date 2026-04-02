import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import ConstellationBackground from './components/ConstellationBackground';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import GroupSpace from './pages/GroupSpace';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  return (
    <div className="min-h-screen bg-transparent text-foreground font-sans selection:bg-primary/30 flex flex-col relative overflow-hidden">
      {/* Interactive Background */}
      <ConstellationBackground />
      
      {/* Decorative Overlay Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[150px] mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <header className="py-6 px-4 md:px-8 flex items-center justify-between z-10 glassmorphism border-b border-white/5 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/50 shadow-[0_0_15px_rgba(255,100,0,0.5)]">
            <span className="font-bold text-neon-orange tracking-tighter">SS</span>
          </div>
          <span className="font-bold text-xl tracking-widest uppercase text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">SmartSplit<span className="text-primary font-mono ml-1 text-sm">v2.0</span></span>
        </div>
      </header>

      <main className="flex-1 w-full relative z-10">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={
            <PublicRoute><Login /></PublicRoute>
          } />
          <Route path="/signup" element={
            <PublicRoute><Signup /></PublicRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/group/:id" element={
            <ProtectedRoute><GroupSpace /></ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
