import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import CreateRoomModal from '../components/CreateRoomModal';
import ProfileHUD from '../components/ProfileHUD';
import OnboardingModal from '../components/OnboardingModal';
import { Play, Users, Hash, RotateCcw, BookOpen } from 'lucide-react';
import { socket } from '../lib/socket';

const rawServerUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const SERVER_URL = rawServerUrl.startsWith('http') ? rawServerUrl : `https://${rawServerUrl}`;

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem('chalkmate_onboarded'));
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinPending, setJoinPending] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const error = location.state?.error;

  // Live public rooms via socket — no polling. Falls back to a single fetch
  // if the socket isn't connected yet.
  useEffect(() => {
    const onUpdate = (rooms) => setPublicRooms(rooms);
    socket.on('public_rooms_update', onUpdate);

    const subscribe = () => socket.emit('home:subscribe');
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    fetch(`${SERVER_URL}/rooms`).then((r) => r.json()).then(setPublicRooms).catch(() => {});

    return () => {
      socket.off('public_rooms_update', onUpdate);
      socket.off('connect', subscribe);
      socket.emit('home:unsubscribe');
    };
  }, []);

  const handleJoinCode = async (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoinError('');
    setJoinPending(true);
    try {
      const resp = await fetch(`${SERVER_URL}/rooms/${code}`);
      if (resp.status === 404) {
        setJoinError(`Room "${code}" doesn't exist.`);
        return;
      }
      if (!resp.ok) {
        setJoinError('Could not check that room. Try again.');
        return;
      }
      const info = await resp.json();
      if (!info.joinable) {
        setJoinError('That room is full or no longer accepting joiners.');
        return;
      }
      navigate(`/room/${code}`);
    } catch {
      setJoinError('Network error. Try again.');
    } finally {
      setJoinPending(false);
    }
  };

  const refreshRooms = async () => {
    setRefreshing(true);
    try {
      const resp = await fetch(`${SERVER_URL}/rooms`);
      const data = await resp.json();
      setPublicRooms(data);
    } catch {
      // network failures are non-fatal — refresh button just shows nothing new
    }
    setTimeout(() => setRefreshing(false), 350);
  };

  const filtered = publicRooms.filter((r) => !subjectFilter || r.subject === subjectFilter);

  return (
    <div className="home-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', position: 'relative' }}>

      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}

      <ProfileHUD />

      <header style={{ textAlign: 'center', marginBottom: '4rem' }} className="animate-fade-in">
        <h1 className="chalk-underline" style={{ fontSize: 'var(--text-5xl)', color: 'var(--text-chalk)', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-chalk)' }}>
          Chalkmate
        </h1>
        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 'var(--space-3)' }}>
          Learn it by teaching it.
        </p>
        {error && (
          <div style={{
            marginTop: 'var(--space-8)', padding: '0.75rem 1.5rem', background: 'rgba(224, 85, 85, 0.1)',
            border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)', fontWeight: 'bold', animation: 'shake 0.5s ease-in-out',
          }}>
            {error}
          </div>
        )}
      </header>

      <main style={{ width: '100%', maxWidth: '900px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>

        {/* Create Room Card */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="glass-panel"
          style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '2px solid rgba(245, 200, 66, 0.18)' }}
        >
          <div style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-xl)', background: 'rgba(245, 200, 66, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Play size={40} color="var(--accent-yellow)" />
          </div>
          <h2 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-chalk)' }}>Host a Session</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: '2.5rem', lineHeight: '1.6' }}>
            Create a custom room, pick a subject, and invite your study group.
          </p>
          <button className="btn btn-accent" onClick={() => setIsModalOpen(true)} style={{ width: '100%', fontSize: 'var(--text-lg)' }}>
            Start a Room
          </button>
        </motion.div>

        {/* Join Room Card */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="glass-panel"
          style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
        >
          <div style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-xl)', background: 'rgba(85, 153, 224, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Hash size={40} color="var(--accent-blue)" />
          </div>
          <h2 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-chalk)' }}>Join by Code</h2>
          <form onSubmit={handleJoinCode} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <input
              type="text"
              placeholder="ROOM CODE"
              value={joinCode}
              maxLength={6}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
              style={{
                width: '100%', padding: '1.2rem', borderRadius: 'var(--radius-lg)', border: '2px solid rgba(255,255,255,0.1)',
                background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-chalk)', fontSize: '1.6rem',
                textAlign: 'center', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 'bold',
                letterSpacing: '0.2em',
              }}
            />
            {joinError && (
              <div style={{ color: 'var(--accent-red)', fontSize: 'var(--text-sm)', textAlign: 'center', animation: 'shake 0.3s ease-in-out' }}>
                {joinError}
              </div>
            )}
            <button type="submit" disabled={joinPending} className="btn" style={{ width: '100%', fontSize: 'var(--text-lg)', fontWeight: 'bold', border: '2px solid var(--accent-blue)', color: 'var(--text-chalk)', opacity: joinPending ? 0.6 : 1 }}>
              {joinPending ? 'Checking…' : 'Enter Room'}
            </button>
          </form>
        </motion.div>
      </main>

      {/* Public Rooms Section */}
      <section style={{ marginTop: '4rem', width: '100%', maxWidth: '800px' }} className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: '1.5rem', borderBottom: 'var(--border-chalk)', paddingBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
            <Users size={24} color="var(--text-chalk)" />
            <h2 style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-chalk)' }}>Live Public Rooms</h2>
            <button
              onClick={refreshRooms}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-dim)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: 'var(--text-xs)', padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-chalk)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; }}
            >
              <RotateCcw size={14} style={{ transition: 'transform 0.4s', transform: refreshing ? 'rotate(-360deg)' : 'rotate(0deg)' }} /> Refresh
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSubjectFilter(null)}
              style={chipStyle(subjectFilter === null)}
            >
              All
            </button>
            {[...new Set(publicRooms.map(r => r.subject).filter(Boolean))].map(sub => (
              <button key={sub} onClick={() => setSubjectFilter(sub)} style={chipStyle(subjectFilter === sub)}>
                {sub}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div style={{
            color: 'var(--text-dim)', textAlign: 'center', padding: '3rem 2rem',
            border: '1px dashed rgba(232,245,232,0.2)', borderRadius: 'var(--radius-lg)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)',
          }}>
            <BookOpen size={36} strokeWidth={1.4} style={{ opacity: 0.45 }} />
            <div>
              <div style={{ color: 'var(--text-chalk)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)', fontFamily: 'var(--font-chalk)', fontWeight: 600 }}>No public rooms — yet.</div>
              <div style={{ fontSize: 'var(--text-sm)' }}>Be the first one in. Start a room to invite the class.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {filtered.map((room) => (
              <motion.div
                key={room.id}
                whileHover={{ x: 4 }}
                className="glass-panel"
                style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-chalk)' }}>{room.name}</span>
                    {room.subject && (
                      <span style={{
                        fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'rgba(245, 200, 66, 0.1)', color: 'var(--accent-yellow)',
                        border: '1px solid rgba(245, 200, 66, 0.2)', textTransform: 'uppercase',
                      }}>
                        {room.subject}{room.subtopic ? ` · ${room.subtopic}` : ''}
                      </span>
                    )}
                    {(room.status === 'playing' || room.status === 'between_rounds' || room.status === 'selecting_topic') && (
                      <span style={{
                        fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'rgba(85, 153, 224, 0.1)', color: 'var(--accent-blue)',
                        border: '1px solid rgba(85, 153, 224, 0.2)', textTransform: 'uppercase',
                      }}>
                        In Progress
                      </span>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 'var(--text-sm)' }}>
                    {room.players}/{room.maxPlayers} players
                  </span>
                </div>
                <button
                  className="btn"
                  disabled={!room.joinable}
                  onClick={() => room.joinable && navigate(`/room/${room.id}`)}
                  style={{
                    padding: '0.5rem 1.25rem',
                    border: room.joinable ? '1px solid var(--accent-blue)' : '1px solid rgba(255,255,255,0.1)',
                    color: room.joinable ? 'var(--text-chalk)' : 'var(--text-dim)',
                    cursor: room.joinable ? 'pointer' : 'not-allowed',
                  }}
                >
                  {room.joinable ? 'Join' : 'Full'}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {isModalOpen && <CreateRoomModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

const chipStyle = (active) => ({
  padding: '0.4rem 1rem', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-sm)',
  background: active ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)',
  color: active ? 'black' : 'var(--text-dim)',
  border: '1px solid rgba(232,245,232,0.1)',
  cursor: 'pointer',
  fontWeight: 600,
});
