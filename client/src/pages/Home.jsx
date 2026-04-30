import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateRoomModal from '../components/CreateRoomModal';
import ProfileHUD from '../components/ProfileHUD';
import { Play, Users, Hash } from 'lucide-react';

const rawServerUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const SERVER_URL = rawServerUrl.startsWith('http') ? rawServerUrl : `https://${rawServerUrl}`;

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [publicRooms, setPublicRooms] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRooms = () => {
      fetch(`${SERVER_URL}/rooms`)
        .then(r => r.json())
        .then(setPublicRooms)
        .catch(() => {});
    };
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinCode = (e) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/room/${joinCode.trim().toUpperCase()}`);
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
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
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

      {/* Public Rooms Section */}
      <section style={{ marginTop: '4rem', width: '100%', maxWidth: '800px' }} className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: 'var(--border-chalk)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <Users size={24} color="var(--text-chalk)" />
            <h2 style={{ fontSize: '1.5rem' }}>Live Public Rooms</h2>
          </div>
          
          {/* Subject Filter Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setSubjectFilter(null)}
              style={{
                padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem',
                background: subjectFilter === null ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)',
                color: subjectFilter === null ? 'black' : 'var(--text-dim)',
                border: '1px solid rgba(232,245,232,0.1)'
              }}
            >
              All
            </button>
            {[...new Set(publicRooms.map(r => r.subject).filter(Boolean))].map(sub => (
              <button
                key={sub}
                onClick={() => setSubjectFilter(sub)}
                style={{
                  padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem',
                  background: subjectFilter === sub ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)',
                  color: subjectFilter === sub ? 'black' : 'var(--text-dim)',
                  border: '1px solid rgba(232,245,232,0.1)'
                }}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
        {publicRooms.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem', border: '1px dashed rgba(232,245,232,0.2)', borderRadius: '8px' }}>
            No public rooms currently available.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {publicRooms
              .filter(r => !subjectFilter || r.subject === subjectFilter)
              .map(room => (
              <div key={room.id} className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-chalk)' }}>{room.name}</span>
                    {room.subject && (
                      <span style={{ 
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', 
                        background: 'rgba(245, 200, 66, 0.1)', color: 'var(--accent-yellow)',
                        border: '1px solid rgba(245, 200, 66, 0.2)', textTransform: 'uppercase'
                      }}>
                        {room.subject} {room.subtopic ? `· ${room.subtopic}` : ''}
                      </span>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {room.players}/{room.maxPlayers} players
                  </span>
                </div>
                <button
                  className="btn"
                  onClick={() => navigate(`/room/${room.id}`)}
                  style={{ padding: '0.5rem 1.25rem', border: '1px solid var(--accent-blue)', color: 'var(--text-chalk)' }}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {isModalOpen && <CreateRoomModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
