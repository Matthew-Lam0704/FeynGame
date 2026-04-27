import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, CheckCircle, Circle, Play, User } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

export default function Lobby() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [playerName] = useState(localStorage.getItem('playerName') || `Player ${Math.floor(Math.random() * 1000)}`);
  
  const { roomState, isConnected, socketId, toggleReady, startGame } = useSocket(roomId, playerName);
  const [isCopied, setIsCopied] = useState(false);

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
  const me = players.find(p => p.id === socketId) || players[0];
  const allReady = players.length >= 2 && players.every(p => p.isReady);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

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
              fontSize: '0.8rem', fontWeight: 'bold', animation: 'fadeInOut 2s forwards'
            }}>
              COPIED!
            </div>
          )}
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
              <div style={{ 
                width: '72px', height: '72px', borderRadius: '50%', 
                background: player.isReady ? '#f5c842' : 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 'bold',
                marginBottom: '1rem', color: player.isReady ? '#1e2e1e' : 'var(--text-chalk)',
                transition: 'all 0.3s ease'
              }}>
                {player.name.charAt(0).toUpperCase()}
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
                onClick={() => startGame({ subject: 'Biology' })} // Default subject for now
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

