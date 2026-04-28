import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Results from './pages/Results';
import Auth from './pages/Auth';
import AvatarCreator from './pages/AvatarCreator';
import { useUserStore } from './store/useUserStore';

function ProtectedRoute({ children }) {
  const user = useUserStore((s) => s.user);
  const isLoading = useUserStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function App() {
  const initAuth = useUserStore((s) => s.initAuth);

  useEffect(() => {
    const cleanup = initAuth();
    return cleanup;
  }, [initAuth]);

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Home />} />
      <Route path="/avatar-creator" element={<ProtectedRoute><AvatarCreator /></ProtectedRoute>} />
      <Route path="/room/:roomId" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
      <Route path="/game/:roomId" element={<ProtectedRoute><Game /></ProtectedRoute>} />
      <Route path="/results/:roomId" element={<ProtectedRoute><Results /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;
