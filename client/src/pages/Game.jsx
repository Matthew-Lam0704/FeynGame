import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Whiteboard from '../components/Whiteboard';
import TopicCard from '../components/TopicCard';
import { useSocket } from '../hooks/useSocket';
import { useAudio } from '../hooks/useAudio';
import { useSounds } from '../hooks/useSounds';
import { Pen, Eraser, Trash2, Clock, Mic, MicOff } from 'lucide-react';

export default function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [playerName] = useState(localStorage.getItem('playerName') || `Player ${Math.floor(Math.random() * 1000)}`);
  const { socket, roomState, isConnected } = useSocket(roomId, playerName);
  
  const explainer = roomState?.players[roomState.currentExplainerIndex];
  const isExplainer = socket?.id === explainer?.id;
  const [micActive, setMicActive] = useState(true);

  // Initialize Audio
  const { room: audioRoom, error: audioError } = useAudio(roomId, playerName, isExplainer, micActive);
  
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [transitionTime, setTransitionTime] = useState(5);
  const [color, setColor] = useState('#e8f5e8');
  const [size, setSize] = useState(3);
  const [tool, setTool] = useState('pen');

  const { play } = useSounds();

  useEffect(() => {
    if (socket) {
      socket.on('timer_sync', (time) => {
        setTimeRemaining(time);
        if (time <= 10 && time > 0) play('TICK');
      });
      socket.on('transition_timer_sync', (time) => setTransitionTime(time));
      return () => {
        socket.off('timer_sync');
        socket.off('transition_timer_sync');
      };
    }
  }, [socket, play]);

  useEffect(() => {
    if (roomState?.status === 'playing') {
      play('WHOOSH');
    } else if (roomState?.status === 'between_rounds') {
      play('BELL');
    } else if (roomState?.status === 'results') {
      navigate(`/results/${roomId}`);
    }
  }, [roomState?.status, play, navigate, roomId]);

  if (!isConnected || !roomState) {
    return <div className="loading-container" style={{ color: 'var(--text-dim)', padding: '2rem' }}>Reconnecting to game...</div>;
  }

  if (roomState.status === 'between_rounds') {
    return (
      <div style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        height: '100vh', gap: '2rem', textAlign: 'center' 
      }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', color: 'var(--accent-yellow)' }}>
          Round Over!
        </h1>
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '500px', width: '90%' }}>
          <h2 style={{ marginBottom: '1rem' }}>Current Standings</h2>
          {roomState.players.sort((a, b) => b.totalPoints - a.totalPoints).map((p, idx) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span>{idx + 1}. {p.name}</span>
              <span style={{ color: 'var(--accent-yellow)' }}>{p.totalPoints.toFixed(1)} pts</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.5rem', color: 'var(--text-dim)' }}>
            Next up: <span style={{ color: 'var(--text-chalk)' }}>{roomState.players[(roomState.currentExplainerIndex + 1) % roomState.players.length]?.name}</span>
          </p>
          <p style={{ fontSize: '1.2rem', color: 'var(--accent-yellow)', marginTop: '1rem' }}>
            Starting in {transitionTime}s...
          </p>
        </div>
      </div>
    );
  }

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

  const submitScore = (val) => {
    if (socket && roomId) {
      socket.emit('submit_score', { roomId, score: val });
    }
  };

  return (
    <div className="game-layout" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', height: '100vh', gap: '1rem' }}>
      
      <TopicCard topic={roomState.topic?.topic} subject={roomState.topic?.subject} />
      
      {/* Top Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {roomState.players.map(p => (
              <div key={p.id} style={{ 
                width: '36px', height: '36px', borderRadius: '50%', background: p.id === explainer?.id ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
                border: p.id === explainer?.id ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                color: p.id === explainer?.id ? 'black' : 'white',
                fontWeight: 'bold', position: 'relative'
              }} title={p.name}>
                {p.name.charAt(0)}
                {p.id === explainer?.id && (
                  <div className="mic-wave" style={{ position: 'absolute', bottom: '-4px', width: '100%', height: '4px', display: 'flex', gap: '2px', justifyContent: 'center' }}>
                    <div className="wave-bar"></div>
                    <div className="wave-bar"></div>
                    <div className="wave-bar"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
          color: timeRemaining <= 20 ? 'var(--accent-red)' : 'var(--text-chalk)',
          border: timeRemaining <= 20 ? '1px solid var(--accent-red)' : 'var(--border-chalk)',
          animation: timeRemaining <= 20 ? 'pulseRed 1s infinite' : 'none',
          boxShadow: timeRemaining <= 20 ? '0 0 15px rgba(224, 85, 85, 0.3)' : 'none'
        }}>
          <Clock size={24} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 'bold' }}>
            {formatTime(timeRemaining)}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
        
        {/* Toolbar (Explainer Only) */}
        {isExplainer && (
          <aside className="glass-panel" style={{ 
            width: '72px', padding: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem',
            borderRight: 'var(--border-chalk)'
          }}>
            <button 
              onClick={() => setTool('pen')}
              className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
              style={{ padding: '12px', background: tool === 'pen' ? 'rgba(245, 200, 66, 0.15)' : 'transparent', borderRadius: '12px' }}
            >
              <Pen size={28} color={tool === 'pen' ? 'var(--accent-yellow)' : 'var(--text-chalk)'} />
            </button>
            <button 
              onClick={() => setTool('eraser')}
              className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
              style={{ padding: '12px', background: tool === 'eraser' ? 'rgba(255, 255, 255, 0.1)' : 'transparent', borderRadius: '12px' }}
            >
              <Eraser size={28} color={tool === 'eraser' ? 'var(--accent-yellow)' : 'var(--text-chalk)'} />
            </button>
            <button 
              onClick={() => {
                if (socket && roomId) {
                  socket.emit('stroke:clear', { roomId });
                }
              }}
              className="tool-btn"
              style={{ padding: '12px', borderRadius: '12px' }}
            >
              <Trash2 size={28} color="var(--accent-red)" />
            </button>

            <div style={{ width: '60%', height: '1px', background: 'rgba(232, 245, 232, 0.1)', margin: '0.5rem 0' }}></div>

            {/* Colors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {colors.map(c => (
                <button 
                  key={c.hex}
                  onClick={() => { setColor(c.hex); setTool('pen'); }}
                  style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', backgroundColor: c.hex,
                    border: color === c.hex && tool === 'pen' ? '3px solid white' : '1px solid rgba(255,255,255,0.2)',
                    boxShadow: color === c.hex && tool === 'pen' ? `0 0 12px ${c.hex}` : 'none',
                    transition: 'all 0.2s ease'
                  }}
                />
              ))}
            </div>

            <div style={{ width: '60%', height: '1px', background: 'rgba(232, 245, 232, 0.1)', margin: '0.5rem 0' }}></div>

            {/* Brush Sizes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[3, 6, 12].map(s => (
                <button 
                  key={s}
                  onClick={() => setSize(s)}
                  style={{ 
                    width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: size === s ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ width: `${s + 4}px`, height: `${s + 4}px`, borderRadius: '50%', background: 'var(--text-chalk)' }} />
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Board Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
          <div style={{ flex: 1, position: 'relative' }}>
             <Whiteboard 
              isExplainer={isExplainer} 
              color={color} 
              size={size} 
              tool={tool} 
              socket={socket}
              roomId={roomId}
            />
            {isExplainer && (
               <div style={{ position: 'absolute', bottom: '20px', left: '20px', pointerEvents: 'none' }}>
                <div className="explainer-tag" style={{ 
                  background: 'var(--accent-yellow)', color: 'black', padding: '6px 12px', 
                  borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 4px 15px rgba(245, 200, 66, 0.4)'
                }}>
                  YOU ARE EXPLAINING
                </div>
              </div>
            )}
          </div>
          
          {/* Bottom Bar: Mic for explainer, Scoring for audience */}
          <div className="glass-panel" style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '1rem 2rem', borderRadius: '16px'
          }}>
            {isExplainer ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <button 
                  onClick={() => setMicActive(!micActive)}
                  style={{ 
                    width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: micActive ? 'rgba(36, 56, 36, 0.8)' : 'rgba(224, 85, 85, 0.4)',
                    border: micActive ? '2px solid var(--text-chalk)' : '2px solid var(--accent-red)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer'
                  }}
                >
                  {micActive ? <Mic size={28} color="var(--text-chalk)" /> : <MicOff size={28} color="var(--accent-red)" />}
                </button>
                <div>
                  <div style={{ color: 'var(--text-chalk)', fontWeight: 'bold' }}>
                    {micActive ? 'Microphone Active' : 'Microphone Muted'}
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    Everyone can hear you explaining!
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', width: '100%', justifyContent: 'center' }}>
                <span style={{ color: 'var(--text-chalk)', fontSize: '1.1rem', fontWeight: '500' }}>Rate this explanation:</span>
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  {[1,2,3,4,5].map(score => (
                    <button 
                      key={score} 
                      onClick={() => submitScore(score)}
                      className={`score-btn ${roomState.roundScores?.[socket.id] === score ? 'active' : ''}`}
                      style={{ 
                        width: '56px', height: '56px', borderRadius: '12px', fontSize: '1.4rem', fontWeight: 'bold',
                        border: '2px solid rgba(232, 245, 232, 0.2)',
                        background: roomState.roundScores?.[socket.id] === score ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)',
                        color: roomState.roundScores?.[socket.id] === score ? 'black' : 'white',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer'
                      }}
                    >
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
