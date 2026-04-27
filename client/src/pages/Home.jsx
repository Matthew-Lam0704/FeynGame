import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateRoomModal from '../components/CreateRoomModal';
import ProfileHUD from '../components/ProfileHUD';
import { Play, Users, Hash } from 'lucide-react';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const navigate = useNavigate();

  const handleJoinCode = (e) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/room/${joinCode.trim()}`);
    }
  };

  return (
    <div className="home-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', position: 'relative' }}>
      
      <ProfileHUD />

      <header style={{ textAlign: 'center', marginBottom: '4rem' }} className="animate-fade-in">
        <h1 style={{ fontSize: '4rem', color: 'var(--text-chalk)', marginBottom: '1rem' }}>
          Feynman Club
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
          explain it simply. win.
        </p>
      </header>

      <main style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '800px', width: '100%' }}>
        
        {/* Create Room Card */}
        <div className="glass-panel" style={{ padding: '2rem', flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Play size={48} color="var(--accent-yellow)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Host a Game</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', marginBottom: '2rem' }}>
            Create a room, choose subjects, and invite friends.
          </p>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ width: '100%', fontSize: '1.2rem', padding: '1rem' }}>
            Create Room
          </button>
        </div>

        {/* Join Room Card */}
        <div className="glass-panel" style={{ padding: '2rem', flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Hash size={48} color="var(--accent-blue)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Join by Code</h2>
          <form onSubmit={handleJoinCode} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" 
              placeholder="Enter Room Code" 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{
                width: '100%', padding: '1rem', borderRadius: '8px', border: 'var(--border-chalk)', 
                background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-chalk)', fontSize: '1.2rem',
                textAlign: 'center', textTransform: 'uppercase'
              }}
            />
            <button type="submit" className="btn" style={{ width: '100%', fontSize: '1.2rem', padding: '1rem', border: '2px solid var(--accent-blue)', color: 'var(--text-chalk)' }}>
              Join Game
            </button>
          </form>
        </div>
      </main>

      {/* Public Rooms Section (Stub) */}
      <section style={{ marginTop: '4rem', width: '100%', maxWidth: '800px' }} className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: 'var(--border-chalk)', paddingBottom: '0.5rem' }}>
          <Users size={24} color="var(--text-chalk)" />
          <h2 style={{ fontSize: '1.5rem' }}>Live Public Rooms</h2>
        </div>
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem', border: '1px dashed rgba(232,245,232,0.2)', borderRadius: '8px' }}>
          No public rooms currently available.
        </div>
      </section>

      {isModalOpen && <CreateRoomModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
