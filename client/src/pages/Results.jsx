import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Home, RefreshCw } from 'lucide-react';

export default function Results() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // Mock final results
  const results = [
    { name: 'Alice', score: 4.8, rank: 1 },
    { name: 'You', score: 4.2, rank: 2 },
    { name: 'Bob', score: 3.5, rank: 3 },
  ];

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh' }}>
      
      <header style={{ textAlign: 'center', marginBottom: '4rem' }} className="animate-fade-in">
        <Trophy size={80} color="var(--accent-gold)" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '3.5rem', color: 'var(--text-chalk)' }}>Final Results</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>Great session, everyone!</p>
      </header>

      <main style={{ width: '100%', maxWidth: '600px', marginBottom: '4rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {results.map((player, i) => (
            <div 
              key={player.name} 
              className="glass-panel animate-fade-in"
              style={{ 
                padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: player.rank === 1 ? '2px solid var(--accent-gold)' : 'var(--border-chalk)',
                animationDelay: `${i * 0.1}s`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <span style={{ 
                  fontSize: '2rem', fontWeight: 'bold', minWidth: '40px',
                  color: player.rank === 1 ? 'var(--accent-gold)' : 'var(--text-dim)'
                }}>
                  #{player.rank}
                </span>
                <div>
                  <h3 style={{ fontSize: '1.5rem' }}>{player.name}</h3>
                  <span style={{ color: 'var(--text-dim)' }}>Avg Score: {player.score}</span>
                </div>
              </div>
              
              {player.rank === 1 && (
                <div style={{ 
                  background: 'var(--accent-gold)', color: 'var(--bg-dark)', padding: '0.2rem 0.8rem', 
                  borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem'
                }}>
                  WINNER
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      <footer style={{ display: 'flex', gap: '1.5rem' }}>
        <button className="btn btn-primary" onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Home size={20} />
          Back Home
        </button>
        <button className="btn" onClick={() => navigate(`/room/${roomId}`)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={20} />
          Play Again
        </button>
      </footer>

    </div>
  );
}
