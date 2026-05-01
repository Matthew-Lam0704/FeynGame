import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

const DURATION_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '90s', value: 90 },
  { label: '2 min', value: 120 },
  { label: '3 min', value: 180 },
];

const selectStyle = {
  width: '100%', padding: '0.8rem', borderRadius: '6px', border: 'var(--border-chalk)',
  backgroundColor: 'var(--bg-dark)', color: 'var(--text-chalk)', fontSize: '1rem'
};

const chipBase = {
  padding: '0.45rem 1rem', borderRadius: '20px', fontSize: '0.9rem',
  fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s ease', border: '2px solid transparent'
};

export default function CreateRoomModal({ onClose }) {
  const [subjectStructure, setSubjectStructure] = useState({});
  const [roomName, setRoomName] = useState('');
  const [subject, setSubject] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roundDuration, setRoundDuration] = useState(90);
  const [roundsPerPlayer, setRoundsPerPlayer] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const serverUrl = raw.startsWith('http') ? raw : `https://${raw}`;
    fetch(`${serverUrl}/subjects`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        setSubjectStructure(data);
        const firstSubject = Object.keys(data)[0];
        if (firstSubject) {
          setSubject(firstSubject);
          setSubtopic(data[firstSubject][0]);
        }
      })
      .catch(err => console.error('[CreateRoomModal] subjects fetch failed:', err));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const raw = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const serverUrl = raw.startsWith('http') ? raw : `https://${raw}`;
    const resp = await fetch(`${serverUrl}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        roomId: roomCode, 
        name: roomName, 
        isPublic, 
        maxPlayers, 
        roundDuration, 
        roundsPerPlayer, 
        subject, 
        subtopic 
      }),
    });

    if (!resp.ok) {
      console.error('Room creation failed:', await resp.json());
      return;
    }

    navigate(`/room/${roomCode}`);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '90%', maxWidth: '520px', padding: '2rem', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--text-dim)' }}>
          <X size={24} />
        </button>

        <h2 style={{ marginBottom: '2rem', fontSize: '2rem', textAlign: 'center' }}>Create Room</h2>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Room Name */}
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

          {/* Subject */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Subject</label>
            <select value={subject} onChange={(e) => {
              setSubject(e.target.value);
              setSubtopic(subjectStructure[e.target.value][0]);
            }} style={selectStyle}>
              {Object.keys(subjectStructure).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Subtopic */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Subtopic</label>
            <select value={subtopic} onChange={(e) => setSubtopic(e.target.value)} style={selectStyle}>
              {(subjectStructure[subject] || []).map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Round Duration */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-dim)' }}>
              Time per turn
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRoundDuration(opt.value)}
                  style={{
                    ...chipBase,
                    background: roundDuration === opt.value ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)',
                    color: roundDuration === opt.value ? '#1e2e1e' : 'var(--text-chalk)',
                    borderColor: roundDuration === opt.value ? 'var(--accent-yellow)' : 'rgba(232,245,232,0.2)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rounds per Player */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-dim)' }}>
              Rounds per player
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRoundsPerPlayer(n)}
                  style={{
                    ...chipBase,
                    width: '48px', height: '48px', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: roundsPerPlayer === n ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)',
                    color: roundsPerPlayer === n ? '#1e2e1e' : 'var(--text-chalk)',
                    borderColor: roundsPerPlayer === n ? 'var(--accent-yellow)' : 'rgba(232,245,232,0.2)',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Each player explains {roundsPerPlayer} time{roundsPerPlayer > 1 ? 's' : ''}
            </p>
          </div>

          {/* Public toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ color: 'var(--text-dim)' }}>Make Room Public</label>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>

          {/* Max Players */}
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

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', fontSize: '1.2rem', padding: '1rem' }}>
            Create Room
          </button>
        </form>
      </div>
    </div>
  );
}
