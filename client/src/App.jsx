import React, { useEffect } from 'react'
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
  const isLoading = useUserStore((state) => state.isLoading)
  const location = useLocation()

  if (isLoading) return null

  if (!user) {
    const hasVisited = localStorage.getItem('hasVisited')
    const mode = hasVisited ? 'login' : 'signup'
    return <Navigate to="/auth" state={{ mode, from: location }} replace />
  }

  return children
}

function App() {
  const initAuth = useUserStore((s) => s.initAuth)

  useEffect(() => {
    const cleanup = initAuth()
    return cleanup
  }, [initAuth])

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

export default App
