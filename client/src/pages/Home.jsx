import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CreateRoomModal from '../components/CreateRoomModal';
import ProfileHUD from '../components/ProfileHUD';
import OnboardingModal from '../components/OnboardingModal';
import { Play, Users, Hash, RotateCcw } from 'lucide-react';

const rawServerUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const SERVER_URL = rawServerUrl.startsWith('http') ? rawServerUrl : `https://${rawServerUrl}`;

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem('feyn_onboarded'));
  const [joinCode, setJoinCode] = useState('');
  const [publicRooms, setPublicRooms] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const error = location.state?.error;

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
      
      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
      
      <ProfileHUD />

      <header style={{ textAlign: 'center', marginBottom: '4rem' }} className="animate-fade-in">
        <h1 style={{ fontSize: '4rem', color: 'var(--text-chalk)', marginBottom: '1rem' }}>
          Feynman Club
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
          explain it simply. win.
        </p>
        {error && (
          <div style={{ 
            marginTop: '2rem', padding: '0.75rem 1.5rem', background: 'rgba(224, 85, 85, 0.1)', 
            border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: '8px',
            fontSize: '0.9rem', fontWeight: 'bold', animation: 'shake 0.5s ease-in-out'
          }}>
            {error}
          </div>
        )}
      </header>

      <main style={{ width: '100%', maxWidth: '900px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        
        {/* Create Room Card */}
        <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transition: 'transform 0.3s ease' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(245, 200, 66, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Play size={40} color="var(--accent-yellow)" />
          </div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.8rem', fontFamily: 'var(--font-serif)' }}>Host a Game</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: '2.5rem', lineHeight: '1.6' }}>
            Create a custom room, choose subjects, and challenge your friends.
          </p>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ width: '100%', fontSize: '1.1rem', fontWeight: 'bold', letterSpacing: '0.02em' }}>
            Create New Room
          </button>
        </div>

        {/* Join Room Card */}
        <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(85, 153, 224, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Hash size={40} color="var(--accent-blue)" />
          </div>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.8rem', fontFamily: 'var(--font-serif)' }}>Join by Code</h2>
          <form onSubmit={handleJoinCode} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <input 
              type="text" 
              placeholder="ROOM CODE" 
              value={joinCode}
              maxLength={6}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              style={{
                width: '100%', padding: '1.2rem', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.1)', 
                background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-chalk)', fontSize: '1.6rem',
                textAlign: 'center', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 'bold',
                letterSpacing: '0.2em'
              }}
            />
            <button type="submit" className="btn" style={{ width: '100%', fontSize: '1.1rem', fontWeight: 'bold', border: '2px solid var(--accent-blue)', color: 'var(--text-chalk)' }}>
              Enter Room
            </button>
          </form>
        </div>
      </main>
      </main>

      {/* Public Rooms Section */}
      <section style={{ marginTop: '4rem', width: '100%', maxWidth: '800px' }} className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: 'var(--border-chalk)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <Users size={24} color="var(--text-chalk)" />
            <h2 style={{ fontSize: '1.5rem' }}>Live Public Rooms</h2>
            <button 
              onClick={() => {
                const fetchRooms = () => {
                  fetch(`${SERVER_URL}/rooms`)
                    .then(r => r.json())
                    .then(setPublicRooms)
                    .catch(() => {});
                };
                fetchRooms();
              }}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-dim)', 
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-chalk)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              <RotateCcw size={14} /> Refresh
            </button>
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
                    {(room.status === 'playing' || room.status === 'between_rounds') && (
                      <span style={{ 
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', 
                        background: 'rgba(85, 153, 224, 0.1)', color: 'var(--accent-blue)',
                        border: '1px solid rgba(85, 153, 224, 0.2)', textTransform: 'uppercase'
                      }}>
                        In Progress
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
