import React, { useEffect, useRef } from 'react';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Home, RefreshCw, Coins } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useUserStore } from '../store/useUserStore';

const COINS_PER_POINT = 5;

export default function Results() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [playerName] = useState(localStorage.getItem('playerName') || `Player ${Math.floor(Math.random() * 1000)}`);
  const { socket, roomState, isConnected } = useSocket(roomId, playerName);
  const { awardCoins } = useUserStore();
  const awardedRef = useRef(false);
  const [coinsEarned, setCoinsEarned] = useState(0);

  useEffect(() => {
    if (!roomState || !socket || awardedRef.current) return;

    // Guard against awarding twice (e.g. re-render or page refresh within same session)
    const awardKey = `awarded_${roomId}`;
    if (localStorage.getItem(awardKey)) return;

    const me = roomState.players.find(p => p.id === socket.id);
    if (!me) return;

    const earned = Math.round((me.totalPoints || 0) * COINS_PER_POINT);
    if (earned > 0) {
      awardCoins(earned);
      localStorage.setItem(awardKey, '1');
      awardedRef.current = true;
      setCoinsEarned(earned);
    } else {
      awardedRef.current = true;
    }
  }, [roomState, socket, roomId, awardCoins]);

  if (!isConnected || !roomState) {
    return <div className="loading-container" style={{ color: 'var(--text-dim)', padding: '2rem', textAlign: 'center' }}>Loading results...</div>;
  }

  const results = [...roomState.players].sort((a, b) => b.totalPoints - a.totalPoints).map((p, i) => ({
    ...p,
    rank: i + 1,
    isMe: p.id === socket?.id,
  }));

  return (
    <div style={{
      padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh',
      background: 'radial-gradient(circle at center, #243824 0%, #1e2e1e 100%)',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.05, zIndex: 0 }}>
        <img src="https://www.transparenttextures.com/patterns/dark-matter.png" alt="" style={{ width: '100%', height: '100%' }} />
      </div>

      <header style={{ textAlign: 'center', marginBottom: '3rem', position: 'relative', zIndex: 1 }} className="animate-fade-in">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Trophy size={100} color="#f5c842" style={{ marginBottom: '1rem', filter: 'drop-shadow(0 0 15px rgba(245, 200, 66, 0.4))' }} />
          <div style={{ position: 'absolute', top: -20, right: -25, transform: 'rotate(15deg)', animation: 'pulseRed 2s infinite' }}>
            <span style={{ fontSize: '4rem', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' }}>👑</span>
          </div>
        </div>
        <h1 style={{ fontSize: '5rem', color: 'var(--text-chalk)', fontFamily: 'var(--font-serif)', marginBottom: '0.5rem', textShadow: '2px 2px 0px rgba(0,0,0,0.5), 0 0 20px rgba(232, 245, 232, 0.2)' }}>
          Final Results
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.4rem', fontStyle: 'italic', maxWidth: '600px', margin: '0 auto' }}>
          "Simplicity is the ultimate sophistication." — Leonardo da Vinci
        </p>

        {/* Coins earned banner */}
        {coinsEarned > 0 && (
          <div style={{
            marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
            background: 'rgba(245, 200, 66, 0.12)', border: '2px solid var(--accent-yellow)',
            padding: '0.6rem 1.5rem', borderRadius: '40px',
            color: 'var(--accent-yellow)', fontWeight: 'bold', fontSize: '1.1rem',
            boxShadow: '0 0 20px rgba(245,200,66,0.2)'
          }}>
            <Coins size={20} />
            +{coinsEarned} coins earned this game!
          </div>
        )}
      </header>

      <main style={{ width: '100%', maxWidth: '700px', marginBottom: '4rem', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {results.map((player, i) => {
            const playerCoins = Math.round((player.totalPoints || 0) * COINS_PER_POINT);
            return (
              <div
                key={player.id}
                className="glass-panel animate-slide-up"
                style={{
                  padding: '1.5rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: player.rank === 1 ? '3px solid #f5c842' : player.isMe ? '2px solid rgba(85,153,224,0.6)' : '1px solid rgba(232, 245, 232, 0.2)',
                  background: player.rank === 1 ? 'rgba(245, 200, 66, 0.08)' : player.isMe ? 'rgba(85,153,224,0.05)' : 'rgba(255, 255, 255, 0.03)',
                  animationDelay: `${i * 0.15}s`, borderRadius: '20px',
                  boxShadow: player.rank === 1 ? '0 10px 30px rgba(245, 200, 66, 0.15)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                  <div style={{
                    fontSize: '2.5rem', fontWeight: 'bold', minWidth: '60px',
                    color: player.rank === 1 ? '#f5c842' : 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    #{player.rank}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.8rem', color: 'var(--text-chalk)', marginBottom: '0.2rem' }}>
                      {player.name} {player.isMe && <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>(you)</span>}
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-dim)', fontSize: '1rem', flexWrap: 'wrap' }}>
                      <span>Score: <b style={{ color: 'var(--text-chalk)' }}>{player.totalPoints.toFixed(1)}</b></span>
                      <span>•</span>
                      <span>Avg: <b style={{ color: 'var(--text-chalk)' }}>{player.avgScore.toFixed(1)}</b></span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Coins size={14} color="var(--accent-yellow)" />
                        <b style={{ color: 'var(--accent-yellow)' }}>+{playerCoins}</b>
                      </span>
                    </div>
                  </div>
                </div>

                {player.rank === 1 && (
                  <div style={{
                    background: '#f5c842', color: '#1e2e1e', padding: '0.5rem 1.2rem',
                    borderRadius: '30px', fontWeight: '900', fontSize: '1rem',
                    letterSpacing: '1px', boxShadow: '0 4px 15px rgba(245, 200, 66, 0.4)'
                  }}>
                    VALEDICTORIAN
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer style={{ display: 'flex', gap: '2rem', position: 'relative', zIndex: 1 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/')} style={{
          display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem 2rem', fontSize: '1.1rem',
          background: 'transparent', border: '2px solid var(--text-chalk)', color: 'var(--text-chalk)', borderRadius: '12px'
        }}>
          <Home size={24} />
          Back Home
        </button>
        <button className="btn btn-primary" onClick={() => navigate(`/room/${roomId}`)} style={{
          display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '1rem 2.5rem', fontSize: '1.1rem',
          background: 'var(--accent-yellow)', border: 'none', color: '#1e2e1e', borderRadius: '12px', fontWeight: 'bold'
        }}>
          <RefreshCw size={24} />
          Play Again
        </button>
      </footer>
    </div>
  );
}
