import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Whiteboard from '../components/Whiteboard';
import { useSocket } from '../hooks/useSocket';
import { useAudio } from '../hooks/useAudio';
import { useSounds } from '../hooks/useSounds';
import { Pen, Eraser, Trash2, Clock, Mic, MicOff, CheckCircle, Type } from 'lucide-react';

export default function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [playerName] = useState(localStorage.getItem('playerName') || `Player ${Math.floor(Math.random() * 1000)}`);
  const { socket, roomState, isConnected } = useSocket(roomId, playerName);

  const explainerIndex = roomState && roomState.players.length > 0
    ? Math.max(0, roomState.currentExplainerIndex) % roomState.players.length
    : 0;
  const explainer = roomState?.players[explainerIndex];
  const isExplainer = socket?.id === explainer?.id;
  const [micActive, setMicActive] = useState(true);
  const isBetweenRounds = roomState?.status === 'between_rounds';

  useAudio(roomId, playerName, isExplainer && !isBetweenRounds, micActive);

  const [timeRemaining, setTimeRemaining] = useState(roomState?.timer || 90);
  const [transitionTime, setTransitionTime] = useState(5);
  const [color, setColor] = useState('#e8f5e8');
  const [size, setSize] = useState(3);
  const [tool, setTool] = useState('pen');
  const [showWordPopup, setShowWordPopup] = useState(false);

  const { play } = useSounds();

  useEffect(() => {
    if (socket) {
      const onTimerSync = (time) => {
        setTimeRemaining(time);
        if (time <= 10 && time > 0) play('TICK');
      };
      const onTransitionSync = (time) => setTransitionTime(time);
      socket.on('timer_sync', onTimerSync);
      socket.on('transition_timer_sync', onTransitionSync);
      return () => {
        socket.off('timer_sync', onTimerSync);
        socket.off('transition_timer_sync', onTransitionSync);
      };
    }
  }, [socket, play]);

  // Sync timer from server when a new round starts
  useEffect(() => {
    if (roomState?.status === 'playing' && roomState.timer !== undefined) {
      setTimeRemaining(roomState.timer);
    }
  }, [roomState?.currentExplainerIndex]);

  // Show word popup at the start of each round
  useEffect(() => {
    if (roomState?.status === 'playing' && roomState?.topic) {
      setShowWordPopup(true);
      const t = setTimeout(() => setShowWordPopup(false), 3000);
      return () => clearTimeout(t);
    }
  }, [roomState?.currentExplainerIndex]);

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
    const nextIndex = (roomState.currentExplainerIndex + 1) % Math.max(1, roomState.players.length);
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
          {[...(roomState.players || [])].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)).map((p, idx) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span>{idx + 1}. {p.name}</span>
              <span style={{ color: 'var(--accent-yellow)' }}>{p.totalPoints.toFixed(1)} pts</span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.5rem', color: 'var(--text-dim)' }}>
            Next up: <span style={{ color: 'var(--text-chalk)' }}>{roomState.players[nextIndex]?.name}</span>
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

  const handleEndTurn = () => {
    if (socket && roomId) {
      socket.emit('end_turn', { roomId });
    }
  };

  const topicWord = roomState?.topic?.term || roomState?.topic?.topic;
  const topicLabel = roomState?.topic
    ? `${roomState.topic.subject}${roomState.topic.subtopic ? ` · ${roomState.topic.subtopic}` : ''}`
    : '';

  return (
    <div className="game-layout" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', height: '100vh', gap: '1rem' }}>

      {/* Word reveal popup — shown for 3 seconds at round start */}
      <AnimatePresence>
        {showWordPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 1.05, y: -20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              style={{ textAlign: 'center', padding: '2rem' }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '1.2rem' }}>
                {topicLabel} — your word:
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '3.5rem', color: 'var(--accent-yellow)', fontWeight: 'bold', textShadow: '0 0 50px rgba(245,200,66,0.5)', lineHeight: 1.1 }}>
                {topicWord}
              </div>
              <div style={{ marginTop: '1.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Explain this using the Feynman technique
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar: players | topic | timer + done */}
      <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '1rem' }}>

        {/* Left: player avatars */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {roomState.players.map(p => (
            <div key={p.id} style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: p.id === explainer?.id ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
              border: p.id === explainer?.id ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
              color: p.id === explainer?.id ? 'black' : 'white',
              fontWeight: 'bold', position: 'relative'
            }} title={p.name}>
              {p.name?.charAt(0).toUpperCase() || '?'}
              {p.id === explainer?.id && (
                <div className="mic-wave" style={{ position: 'absolute', bottom: '-4px', width: '100%', height: '4px', display: 'flex', gap: '2px', justifyContent: 'center' }}>
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Center: topic */}
        <AnimatePresence mode="wait">
          <motion.div
            key={topicWord}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            style={{ textAlign: 'center' }}
          >
            <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '2px' }}>
              {topicLabel} — explain:
            </div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: 'var(--accent-yellow)',
              fontWeight: 'bold', textShadow: '0 0 20px rgba(245,200,66,0.3)'
            }}>
              {topicWord}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Right: timer + done button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end' }}>
          {isExplainer && (
            <button
              onClick={handleEndTurn}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 1.2rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem',
                background: 'rgba(36, 200, 100, 0.15)', border: '2px solid rgba(36, 200, 100, 0.6)',
                color: '#4cdb8a', cursor: 'pointer', transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(36, 200, 100, 0.3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(36, 200, 100, 0.15)'}
            >
              <CheckCircle size={18} />
              Done
            </button>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1.2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
            color: timeRemaining <= 20 ? 'var(--accent-red)' : 'var(--text-chalk)',
            border: timeRemaining <= 20 ? '1px solid var(--accent-red)' : 'var(--border-chalk)',
            animation: timeRemaining <= 20 ? 'pulseRed 1s infinite' : 'none',
            boxShadow: timeRemaining <= 20 ? '0 0 15px rgba(224, 85, 85, 0.3)' : 'none'
          }}>
            <Clock size={20} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 'bold' }}>
              {formatTime(timeRemaining)}
            </span>
          </div>
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
              onClick={() => setTool('text')}
              className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
              style={{ padding: '12px', background: tool === 'text' ? 'rgba(85, 153, 224, 0.15)' : 'transparent', borderRadius: '12px' }}
            >
              <Type size={28} color={tool === 'text' ? '#5599e0' : 'var(--text-chalk)'} />
            </button>
            <button
              onClick={() => { if (socket && roomId) socket.emit('stroke:clear', { roomId }); }}
              className="tool-btn"
              style={{ padding: '12px', borderRadius: '12px' }}
            >
              <Trash2 size={28} color="var(--accent-red)" />
            </button>

            <div style={{ width: '60%', height: '1px', background: 'rgba(232, 245, 232, 0.1)', margin: '0.5rem 0' }} />

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

            <div style={{ width: '60%', height: '1px', background: 'rgba(232, 245, 232, 0.1)', margin: '0.5rem 0' }} />

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
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer'
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
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      onClick={() => submitScore(score)}
                      className={`score-btn ${roomState.roundScores?.[socket.id] === score ? 'active' : ''}`}
                      style={{
                        width: '56px', height: '56px', borderRadius: '12px', fontSize: '1.4rem', fontWeight: 'bold',
                        border: '2px solid rgba(232, 245, 232, 0.2)',
                        background: roomState.roundScores?.[socket.id] === score ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)',
                        color: roomState.roundScores?.[socket.id] === score ? 'black' : 'white',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer'
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
