import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

export default function CreateRoomModal({ onClose }) {
  const [roomName, setRoomName] = useState('');
  const [subject, setSubject] = useState('physics');
  const [isPublic, setIsPublic] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const navigate = useNavigate();

  const handleCreate = async (e) => {
    e.preventDefault();
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    await fetch(`${serverUrl}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: roomCode, name: roomName, isPublic, maxPlayers }),
    });
    navigate(`/room/${roomCode}`);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '90%', maxWidth: '500px', padding: '2rem', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--text-dim)' }}>
          <X size={24} />
        </button>
        
        <h2 style={{ marginBottom: '2rem', fontSize: '2rem', textAlign: 'center' }}>Create Room</h2>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Room Name</label>
            <input 
              type="text" 
              required
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Late Night Study"
              style={{
                width: '100%', padding: '0.8rem', borderRadius: '6px', border: 'var(--border-chalk)', 
                background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-chalk)', fontSize: '1rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Subject</label>
            <select 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                width: '100%', padding: '0.8rem', borderRadius: '6px', border: 'var(--border-chalk)', 
                background: 'var(--bg-dark)', color: 'var(--text-chalk)', fontSize: '1rem'
              }}
            >
              <option value="physics">Physics</option>
              <option value="biology">Biology</option>
              <option value="chemistry">Chemistry</option>
              <option value="maths">Mathematics</option>
              <option value="history">History</option>
              <option value="economics">Economics</option>
              <option value="custom">Custom (All Topics)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ color: 'var(--text-dim)' }}>Make Room Public</label>
            <input 
              type="checkbox" 
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Max Players: {maxPlayers}</label>
            <input 
              type="range" 
              min="2" max="8" 
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '1.2rem', padding: '1rem' }}>
            Start Game
          </button>
        </form>
      </div>
    </div>
  );
}
