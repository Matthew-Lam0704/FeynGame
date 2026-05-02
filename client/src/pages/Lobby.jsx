import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, CheckCircle, Circle, Play, User, Clock, RotateCcw, BookOpen, Globe, Lock, Settings, Share2 } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import AvatarFrame from '../components/AvatarFrame';

export default function Lobby() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [playerName] = useState(localStorage.getItem('playerName') || `Player ${Math.floor(Math.random() * 1000)}`);
  
  const { roomState, isConnected, socketId, toggleReady, startGame, socket } = useSocket(roomId, playerName, navigate);
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedUrl, setIsCopiedUrl] = useState(false);
  const [subjects, setSubjects] = useState({});

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const copyRoomUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopiedUrl(true);
    setTimeout(() => setIsCopiedUrl(false), 2000);
  };

  useEffect(() => {
    const raw = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const serverUrl = raw.startsWith('http') ? raw : `https://${raw}`;
    fetch(`${serverUrl}/subjects`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setSubjects)
      .catch(console.error);

    // Check if room exists
    fetch(`${serverUrl}/rooms/${roomId}`)
      .then(r => {
        if (r.status === 404) {
          navigate('/', { state: { error: 'Room not found' } });
        }
      })
      .catch(() => {});
  }, [roomId, navigate]);

  useEffect(() => {
    const onJoinError = (err) => {
      if (err.code === 'ROOM_NOT_FOUND') {
        navigate('/', { state: { error: 'Room not found or session ended.' } });
      }
    };
    socket.on('join_error', onJoinError);
    return () => {
      socket.off('join_error', onJoinError);
    };
  }, [socket, navigate]);

  useEffect(() => {
    if (roomState?.status === 'playing') {
      navigate(`/game/${roomId}`);
    }
  }, [roomState?.status, roomId, navigate]);

  if (!isConnected || !roomState) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem' }}>
        <div className="spinner"></div>
        <div style={{ color: 'var(--text-dim)', fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>
          Connecting to chalk server...
        </div>
      </div>
    );
  }

  const players = roomState.players;
  const me = players.find(p => p.id === socketId);
  const allReady = players.length >= 2 && players.every(p => p.isReady);

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', background: 'radial-gradient(circle at top, #243824 0%, #1e2e1e 100%)' }}>
      
      <header style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
        <h1 style={{ fontSize: '3.5rem', color: 'var(--text-chalk)', marginBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
          Study Hall
        </h1>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem' }}>Invite your classmates to begin the session.</p>
        
        <div 
          onClick={copyRoomCode}
          style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '1rem', 
            padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.03)', 
            border: '2px dashed rgba(232, 245, 232, 0.3)', borderRadius: '12px', cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative'
          }}
          className="room-code-badge"
        >
          <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-mono)', letterSpacing: '3px', color: 'var(--accent-yellow)', fontWeight: 'bold' }}>
            {roomId}
          </span>
          <Copy size={24} color={isCopied ? "#f5c842" : "rgba(232, 245, 232, 0.5)"} />
          {isCopied && (
            <div style={{ 
              position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
              background: '#f5c842', color: '#1e2e1e', padding: '4px 12px', borderRadius: '4px',
              fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap'
            }}>
              Code Copied!
            </div>
          )}
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={copyRoomUrl}
            className="btn"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '0.6rem 1.2rem', fontSize: '0.9rem',
              background: 'rgba(85, 153, 224, 0.1)', border: '1px solid rgba(85, 153, 224, 0.3)',
              color: 'var(--accent-blue)', borderRadius: '8px', cursor: 'pointer'
            }}
          >
            <Share2 size={16} />
            {isCopiedUrl ? 'Link Copied!' : 'Copy Invite Link'}
          </button>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '900px' }}>
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem', marginBottom: '4rem'
        }}>
          {players.map(player => (
            <div key={player.id} className="glass-panel animate-fade-in" style={{ 
              padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
              border: player.isReady ? '2px solid #f5c842' : '1px solid rgba(232, 245, 232, 0.1)',
              background: player.isReady ? 'rgba(245, 200, 66, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              borderRadius: '20px', transition: 'all 0.3s ease',
              position: 'relative',
              boxShadow: player.isReady ? '0 8px 25px rgba(245, 200, 66, 0.1)' : 'none'
            }}>
              {player.id === socketId && (
                <div style={{ 
                  position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.1)',
                  padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', color: 'var(--text-dim)'
                }}>
                  YOU
                </div>
              )}
              <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <AvatarFrame 
                  src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${player.name}`} 
                  size={100}
                  frameId={player.selectedFrameId}
                />
                {player.isReady && (
                  <div style={{ 
                    position: 'absolute', inset: '-10px', borderRadius: '50%', 
                    border: '3px solid var(--accent-yellow)',
                    boxShadow: '0 0 20px var(--accent-yellow), inset 0 0 10px var(--accent-yellow)',
                    animation: 'pulseRed 2s infinite'
                  }} />
                )}
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: 'var(--text-chalk)' }}>{player.name}</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: player.isReady ? '#f5c842' : 'var(--text-dim)' }}>
                {player.isReady ? <CheckCircle size={20} /> : <Circle size={20} />}
                <span style={{ fontWeight: player.isReady ? 'bold' : 'normal' }}>
                  {player.isReady ? 'Ready to Learn' : 'Prepping...'}
                </span>
              </div>
              
              {player.isHost && (
                <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={12} /> HOST
                </div>
              )}
            </div>
          ))}
          
          {players.length < 8 && (
            <div style={{ 
              padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed rgba(232, 245, 232, 0.1)', borderRadius: '20px', minHeight: '200px',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <div style={{ color: 'rgba(232, 245, 232, 0.2)', marginBottom: '1rem' }}>
                <User size={48} strokeWidth={1} />
              </div>
              <span style={{ color: 'rgba(232, 245, 232, 0.3)', fontStyle: 'italic', fontSize: '0.9rem' }}>Waiting for players...</span>
            </div>
          )}
        </div>

        {/* Room Info/Settings Widget */}
        <div className="glass-panel" style={{ 
          padding: '1.5rem', marginBottom: '4rem', display: 'flex', flexDirection: 'column', gap: '1.5rem',
          border: '1px solid rgba(232, 245, 232, 0.15)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-dim)', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} color="var(--accent-yellow)" />
                <span style={{ color: 'var(--text-chalk)', fontWeight: 'bold' }}>{roomState.roundDuration}s</span> per turn
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={18} color="var(--accent-blue)" />
                <span style={{ color: 'var(--text-chalk)', fontWeight: 'bold' }}>{roomState.roundsPerPlayer}</span> rounds
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} color="var(--accent-red)" />
                <span style={{ color: 'var(--text-chalk)', fontWeight: 'bold' }}>{roomState.subject}</span>
                {roomState.subtopic && <span style={{ opacity: 0.7 }}>› {roomState.subtopic}</span>}
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' }}>
              {roomState.isPublic ? <Globe size={16} color="var(--accent-blue)" /> : <Lock size={16} color="var(--text-dim)" />}
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: roomState.isPublic ? 'var(--accent-blue)' : 'var(--text-dim)' }}>
                {roomState.isPublic ? 'PUBLIC ROOM' : 'PRIVATE ROOM'}
              </span>
            </div>
          </div>

          {/* Host Controls */}
          {me?.isHost && (
            <div style={{ borderTop: '1px solid rgba(232, 245, 232, 0.1)', paddingTop: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-yellow)', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                <Settings size={16} />
                Host Settings
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Subject</label>
                  <select 
                    value={roomState.subject || ''} 
                    onChange={(e) => socket.emit('update_room_settings', { roomId, subject: e.target.value, subtopic: subjects[e.target.value]?.[0] || '' })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem', borderRadius: '8px', color: 'white' }}
                  >
                    {Object.keys(subjects).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Subtopic</label>
                  <select 
                    value={roomState.subtopic || ''} 
                    onChange={(e) => socket.emit('update_room_settings', { roomId, subtopic: e.target.value })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem', borderRadius: '8px', color: 'white' }}
                  >
                    {(subjects[roomState.subject] || []).map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>

                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Turn Duration</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[30, 60, 90, 120].map(d => (
                      <button 
                        key={d} 
                        onClick={() => socket.emit('update_room_settings', { roomId, roundDuration: d })}
                        style={{ 
                          flex: 1, padding: '0.4rem', borderRadius: '6px', fontSize: '0.8rem',
                          background: roomState.roundDuration === d ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)',
                          color: roomState.roundDuration === d ? 'black' : 'white',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Visibility</label>
                  <button 
                    onClick={() => socket.emit('update_room_visibility', { roomId, isPublic: !roomState.isPublic })}
                    style={{ 
                      width: '100%', padding: '0.6rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold',
                      background: roomState.isPublic ? 'rgba(85, 153, 224, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: roomState.isPublic ? 'var(--accent-blue)' : 'var(--text-dim)',
                      border: roomState.isPublic ? '1px solid var(--accent-blue)' : '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    Set to {roomState.isPublic ? 'Private' : 'Public'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button 
              className={`btn ${me?.isReady ? 'btn-secondary' : 'btn-primary'}`} 
              onClick={toggleReady}
              style={{ 
                fontSize: '1.3rem', padding: '1rem 3rem', borderRadius: '14px', minWidth: '220px',
                background: me?.isReady ? 'transparent' : 'var(--text-chalk)',
                color: me?.isReady ? 'var(--text-chalk)' : '#1e2e1e',
                border: '2px solid var(--text-chalk)',
                fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {me?.isReady ? 'Wait, Not Ready' : 'Ready Up'}
            </button>
            
            {me?.isHost && (
              <button 
                className="btn" 
                onClick={() => startGame()}
                disabled={!allReady}
                style={{ 
                  fontSize: '1.3rem', padding: '1rem 3rem', borderRadius: '14px', minWidth: '220px',
                  backgroundColor: allReady ? '#5599e0' : 'rgba(255,255,255,0.05)',
                  color: allReady ? '#fff' : 'rgba(255,255,255,0.2)',
                  border: allReady ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  cursor: allReady ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem',
                  fontWeight: 'bold', transition: 'all 0.3s ease',
                  boxShadow: allReady ? '0 10px 20px rgba(85, 153, 224, 0.3)' : 'none'
                }}
              >
                <Play size={24} fill={allReady ? "white" : "transparent"} />
                Start Session
              </button>
            )}
          </div>
          
          {!allReady && players.length >= 2 && (
            <p style={{ color: 'var(--accent-yellow)', fontSize: '0.9rem', animation: 'pulse 2s infinite' }}>
              Waiting for everyone to ready up...
            </p>
          )}
          {players.length < 2 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              Need at least 2 players to start.
            </p>
          )}
        </div>
      </main>

    </div>
  );
}

