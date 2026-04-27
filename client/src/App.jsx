import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'
// import Results from './pages/Results'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<Lobby />} />
      <Route path="/game/:roomId" element={<Game />} />
      {/* <Route path="/results/:roomId" element={<Results />} /> */}
    </Routes>
  )
}

export default App
