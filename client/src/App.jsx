import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
import Results from './pages/Results'
import Auth from './pages/Auth'
import AvatarCreator from './pages/AvatarCreator'
import { useUserStore } from './store/useUserStore'

function RequireAuth({ children }) {
  const user = useUserStore((state) => state.user)
  const location = useLocation()

  if (!user) {
    const hasVisited = localStorage.getItem('hasVisited')
    const mode = hasVisited ? 'login' : 'signup'
    return <Navigate to="/auth" state={{ mode, from: location }} replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/avatar-creator" element={<RequireAuth><AvatarCreator /></RequireAuth>} />
      <Route path="/room/:roomId" element={<RequireAuth><Lobby /></RequireAuth>} />
      <Route path="/game/:roomId" element={<RequireAuth><Game /></RequireAuth>} />
      <Route path="/results/:roomId" element={<RequireAuth><Results /></RequireAuth>} />
    </Routes>
  )
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
