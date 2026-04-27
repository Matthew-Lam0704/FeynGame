import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, CheckCircle, Circle, Play } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

export default function Lobby() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [playerName] = useState(`Player ${Math.floor(Math.random() * 1000)}`);
  
  const { roomState, isConnected, toggleReady, startGame } = useSocket(roomId, playerName);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (roomState?.status === 'playing') {
      navigate(`/game/${roomId}`);
    }
  }, [roomState, roomId, navigate]);

  if (!isConnected || !roomState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-dim)' }}>
        Connecting to chalk server...
      </div>
    );
  }

  const players = roomState.players;
  const me = players.find(p => p.id === roomState.players.find(pl => pl.name === playerName)?.id) || players[0];
  const allReady = players.length >= 2 && players.every(p => p.isReady);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh' }}>
      
      <header style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '2rem' }}>
        <h1 style={{ fontSize: '3rem', color: 'var(--text-chalk)', marginBottom: '0.5rem' }}>
          Waiting Room
        </h1>
        
        <div 
          onClick={copyRoomCode}
          style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem', 
            padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', 
            border: '1px dashed var(--text-dim)', borderRadius: '8px', cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          className="hover-bg-light"
        >
          <span style={{ fontSize: '1.5rem', fontFamily: 'var(--font-mono)', letterSpacing: '2px', color: 'var(--accent-yellow)' }}>
            {roomId}
          </span>
          <Copy size={20} color={isCopied ? "var(--accent-gold)" : "var(--text-dim)"} />
          {isCopied && <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem', position: 'absolute', transform: 'translateY(-30px)' }}>Copied!</span>}
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '800px' }}>
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem'
        }}>
          {players.map(player => (
            <div key={player.id} className="glass-panel" style={{ 
              padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
              border: player.isReady ? '2px solid var(--accent-gold)' : 'var(--border-chalk)'
            }}>
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold',
                marginBottom: '1rem', color: player.isReady ? 'var(--accent-gold)' : 'var(--text-chalk)'
              }}>
                {player.name.substring(0, 2).toUpperCase()}
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{player.name}</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: player.isReady ? 'var(--accent-gold)' : 'var(--text-dim)' }}>
                {player.isReady ? <CheckCircle size={18} /> : <Circle size={18} />}
                <span>{player.isReady ? 'Ready' : 'Waiting...'}</span>
              </div>
            </div>
          ))}
          
          {/* Empty slot placeholder */}
          <div style={{ 
            padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '2px dashed rgba(232,245,232,0.2)', borderRadius: '12px', minHeight: '180px'
          }}>
            <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Waiting for players...</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button 
            className={`btn ${me.isReady ? '' : 'btn-primary'}`} 
            onClick={toggleReady}
            style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}
          >
            {me.isReady ? 'Not Ready' : 'I am Ready'}
          </button>
          
          {me.isHost && (
            <button 
              className="btn" 
              onClick={startGame}
              disabled={!allReady || players.length < 2}
              style={{ 
                fontSize: '1.2rem', padding: '1rem 2rem', 
                backgroundColor: (allReady && players.length >= 2) ? 'var(--accent-blue)' : 'var(--bg-light)',
                color: (allReady && players.length >= 2) ? '#fff' : 'var(--text-dim)',
                cursor: (allReady && players.length >= 2) ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              <Play size={20} />
              Start Game
            </button>
          )}
        </div>
      </main>

    </div>
  );
}
