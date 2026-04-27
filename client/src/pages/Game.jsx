import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Whiteboard from '../components/Whiteboard';
import { Pen, Eraser, Trash2, Clock, Mic, MicOff } from 'lucide-react';

export default function Game() {
  const { roomId } = useParams();
  
  // Mock state for UI dev
  const [isExplainer, setIsExplainer] = useState(true);
  const [topic, setTopic] = useState("Mitosis");
  const [timeRemaining, setTimeRemaining] = useState(85);
  const [color, setColor] = useState('#e8f5e8');
  const [size, setSize] = useState(3);
  const [tool, setTool] = useState('pen');
  const [micActive, setMicActive] = useState(true);

  const colors = [
    { name: 'White', hex: '#e8f5e8' },
    { name: 'Yellow', hex: '#f5c842' },
    { name: 'Red', hex: '#e05555' },
    { name: 'Blue', hex: '#5599e0' }
  ];

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', height: '100vh', gap: '1rem' }}>
      
      {/* Top Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            padding: '0.5rem 1rem', background: 'var(--bg-light)', borderRadius: '8px',
            border: 'var(--border-chalk)'
          }}>
            <span style={{ color: 'var(--text-dim)', marginRight: '0.5rem' }}>Topic:</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--accent-yellow)' }}>
              {topic}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {/* Mock audience avatars */}
            {[1,2,3].map(i => (
              <div key={i} style={{ 
                width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                A{i}
              </div>
            ))}
          </div>
        </div>

        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1rem', background: 'var(--bg-light)', borderRadius: '8px',
          color: timeRemaining <= 20 ? 'var(--accent-red)' : 'var(--text-chalk)',
          animation: timeRemaining <= 20 ? 'pulseRed 1s infinite' : 'none'
        }}>
          <Clock size={20} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {formatTime(timeRemaining)}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
        
        {/* Toolbar (Explainer Only) */}
        {isExplainer && (
          <aside className="glass-panel" style={{ 
            width: '64px', padding: '1rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
          }}>
            <button 
              onClick={() => setTool('pen')}
              style={{ padding: '8px', background: tool === 'pen' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '8px' }}
            >
              <Pen size={24} color={tool === 'pen' ? 'var(--accent-yellow)' : 'var(--text-chalk)'} />
            </button>
            <button 
              onClick={() => setTool('eraser')}
              style={{ padding: '8px', background: tool === 'eraser' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '8px' }}
            >
              <Eraser size={24} color={tool === 'eraser' ? 'var(--accent-yellow)' : 'var(--text-chalk)'} />
            </button>
            <button 
              onClick={() => { /* Handle clear */ }}
              style={{ padding: '8px', marginTop: 'auto' }}
            >
              <Trash2 size={24} color="var(--accent-red)" />
            </button>

            <div style={{ width: '80%', height: '1px', background: 'var(--border-chalk)', margin: '0.5rem 0' }}></div>

            {/* Colors */}
            {colors.map(c => (
              <button 
                key={c.hex}
                onClick={() => { setColor(c.hex); setTool('pen'); }}
                style={{ 
                  width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c.hex,
                  border: color === c.hex && tool === 'pen' ? '2px solid white' : '2px solid transparent',
                  boxShadow: color === c.hex && tool === 'pen' ? '0 0 8px rgba(255,255,255,0.5)' : 'none'
                }}
              />
            ))}

            <div style={{ width: '80%', height: '1px', background: 'var(--border-chalk)', margin: '0.5rem 0' }}></div>

            {/* Brush Sizes */}
            {[2, 5, 10].map(s => (
              <button 
                key={s}
                onClick={() => setSize(s)}
                style={{ 
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: size === s ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '8px'
                }}
              >
                <div style={{ width: `${s * 2}px`, height: `${s * 2}px`, borderRadius: '50%', background: 'var(--text-chalk)' }} />
              </button>
            ))}
          </aside>
        )}

        {/* Board Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
          <Whiteboard isExplainer={isExplainer} color={color} size={size} tool={tool} />
          
          {/* Bottom Bar: Mic for explainer, Scoring for audience */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem' }}>
            {isExplainer ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                  onClick={() => setMicActive(!micActive)}
                  className="glass-panel"
                  style={{ 
                    padding: '0.8rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: micActive ? 'rgba(36, 56, 36, 0.6)' : 'rgba(224, 85, 85, 0.2)'
                  }}
                >
                  {micActive ? <Mic size={24} color="var(--text-chalk)" /> : <MicOff size={24} color="var(--accent-red)" />}
                </button>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                  {micActive ? 'Your mic is live' : 'You are muted'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', justifyContent: 'center' }}>
                <span style={{ color: 'var(--text-dim)' }}>Rate this explanation:</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[1,2,3,4,5].map(score => (
                    <button key={score} className="glass-panel" style={{ 
                      width: '48px', height: '48px', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold',
                      border: 'var(--border-chalk)'
                    }}>
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </main>

    </div>
  );
}
