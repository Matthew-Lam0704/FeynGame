import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Whiteboard from '../components/Whiteboard';
import ChatBox from '../components/ChatBox';
import ColorWheel from '../components/ColorWheel';
import { useSocket } from '../hooks/useSocket';
import { useAudio } from '../hooks/useAudio';
import { useSounds } from '../hooks/useSounds';
import { 
  Pen, Eraser, Trash2, Clock, Mic, MicOff, CheckCircle, Type, Users, XCircle,
  Square, Circle as CircleIcon, Minus, ArrowRight
} from 'lucide-react';

export default function Game() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [playerName] = useState(localStorage.getItem('playerName') || `Player ${Math.floor(Math.random() * 1000)}`);
  const { socket, roomState, isConnected } = useSocket(roomId, playerName, navigate);

  const explainerIndex = roomState && roomState.players.length > 0
    ? Math.max(0, roomState.currentExplainerIndex) % roomState.players.length
    : 0;
  const explainer = roomState?.players[explainerIndex];
  const isExplainer = socket?.id === explainer?.id;
  const [micActive, setMicActive] = useState(true);
  const isBetweenRounds = roomState?.status === 'between_rounds';

  useAudio(roomId, playerName, isExplainer && !isBetweenRounds, micActive);

  const [timeRemaining, setTimeRemaining] = useState(90); // properly overwritten by useEffect below
  const [transitionTime, setTransitionTime] = useState(5);
  const [color, setColor] = useState('#e8f5e8');
  const [size, setSize] = useState(3);
  const [tool, setTool] = useState('pen');
  const [showWordPopup, setShowWordPopup] = useState(false);
  const [doneCountdown, setDoneCountdown] = useState(null);
  const [elasticity, setElasticity] = useState(0.3);

  const { play } = useSounds();

  useEffect(() => {
    if (socket) {
      const onTimerSync = (time) => {
        setTimeRemaining(time);
        if (time <= 10 && time > 0) play('TICK');
      };
      const onTransitionSync = (time) => setTransitionTime(time);
      
      const onDoneStart = ({ duration }) => {
        setDoneCountdown(duration);
        play('TICK');
      };
      const onDoneCancel = () => setDoneCountdown(null);

      socket.on('timer_sync', onTimerSync);
      socket.on('transition_timer_sync', onTransitionSync);
      socket.on('done_countdown_start', onDoneStart);
      socket.on('done_countdown_cancel', onDoneCancel);

      return () => {
        socket.off('timer_sync', onTimerSync);
        socket.off('transition_timer_sync', onTransitionSync);
        socket.off('done_countdown_start', onDoneStart);
        socket.off('done_countdown_cancel', onDoneCancel);
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

  // Done countdown ticker — must be before any early returns to keep hook order stable
  useEffect(() => {
    if (doneCountdown === null) return;
    if (doneCountdown <= 0) {
      setDoneCountdown(null);
      return;
    }
    const t = setInterval(() => {
      setDoneCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [doneCountdown]);

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
    if (socket && roomId) socket.emit('end_turn_request', { roomId });
  };

  const handleCancelEndTurn = () => {
    if (socket && roomId) socket.emit('cancel_end_turn', { roomId });
  };

  const handleSelectTopic = (t) => {
    if (socket && roomId) socket.emit('topic:select', { roomId, topic: t });
  };

  const topicWord = roomState?.topic?.term || roomState?.topic?.topic;
  const topicLabel = roomState?.topic
    ? `${roomState.topic.subject}${roomState.topic.subtopic ? ` · ${roomState.topic.subtopic}` : ''}`
    : '';

  return (
    <div className="game-layout" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', height: '100vh', gap: '1rem' }}>

      {/* Topic Selection Overlay */}
      <AnimatePresence>
        {roomState.status === 'selecting_topic' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 110,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ textAlign: 'center', maxWidth: '600px', width: '90%' }}>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--text-dim)', marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {isExplainer ? 'Choose a topic to explain' : `${explainer?.name} is choosing a topic...`}
              </h2>
              
              {isExplainer ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {roomState.topicChoices?.map((t, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectTopic(t)}
                      className="glass-panel"
                      style={{
                        padding: '1.5rem', cursor: 'pointer', textAlign: 'left',
                        border: '1px solid rgba(255,255,255,0.1)',
                        transition: 'background 0.2s',
                        background: 'rgba(255,255,255,0.03)'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{t.subject}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-chalk)' }}>{t.term}</div>
                    </motion.button>
                  ))}
                  <div style={{ marginTop: '1.5rem', color: 'var(--accent-yellow)', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                    {timeRemaining}s
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                   <div className="spinner" style={{ width: '50px', height: '50px' }} />
                   <div style={{ color: 'var(--accent-yellow)', fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                     {timeRemaining}s
                   </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            doneCountdown !== null ? (
              <button
                onClick={handleCancelEndTurn}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1.2rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem',
                  background: 'rgba(224, 85, 85, 0.15)', border: '2px solid var(--accent-red)',
                  color: 'var(--accent-red)', cursor: 'pointer', animation: 'pulseRed 1s infinite'
                }}
              >
                <XCircle size={18} />
                Cancel ({doneCountdown}s)
              </button>
            ) : (
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
            )
          )}
          {!isExplainer && doneCountdown !== null && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontStyle: 'italic', marginRight: '0.5rem' }}>
              Ending turn in {doneCountdown}s...
            </div>
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
      <main style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0, padding: '1.5rem', overflow: 'hidden' }}>

        {/* Toolbar (Explainer Only) */}
        {isExplainer && (
          <aside className="glass-panel" style={{
            position: 'absolute', left: '2.5rem', top: '50%', transform: 'translateY(-50%)',
            width: '72px', padding: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem',
            zIndex: 100, borderRadius: '36px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            border: '1px solid rgba(232, 245, 232, 0.15)', maxHeight: '85vh', overflowY: 'auto'
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

            <div style={{ width: '60%', height: '1px', background: 'rgba(232, 245, 232, 0.1)', margin: '0.2rem 0' }} />

            <button
              onClick={() => setTool('line')}
              className={`tool-btn ${tool === 'line' ? 'active' : ''}`}
              style={{ padding: '12px', background: tool === 'line' ? 'rgba(255, 255, 255, 0.1)' : 'transparent', borderRadius: '12px' }}
            >
              <Minus size={28} color={tool === 'line' ? 'var(--accent-yellow)' : 'var(--text-chalk)'} style={{ transform: 'rotate(-45deg)' }} />
            </button>
            <button
              onClick={() => setTool('rect')}
              className={`tool-btn ${tool === 'rect' ? 'active' : ''}`}
              style={{ padding: '12px', background: tool === 'rect' ? 'rgba(255, 255, 255, 0.1)' : 'transparent', borderRadius: '12px' }}
            >
              <Square size={28} color={tool === 'rect' ? 'var(--accent-yellow)' : 'var(--text-chalk)'} />
            </button>
            <button
              onClick={() => setTool('circle')}
              className={`tool-btn ${tool === 'circle' ? 'active' : ''}`}
              style={{ padding: '12px', background: tool === 'circle' ? 'rgba(255, 255, 255, 0.1)' : 'transparent', borderRadius: '12px' }}
            >
              <CircleIcon size={28} color={tool === 'circle' ? 'var(--accent-yellow)' : 'var(--text-chalk)'} />
            </button>
            <button
              onClick={() => setTool('arrow')}
              className={`tool-btn ${tool === 'arrow' ? 'active' : ''}`}
              style={{ padding: '12px', background: tool === 'arrow' ? 'rgba(255, 255, 255, 0.1)' : 'transparent', borderRadius: '12px' }}
            >
              <ArrowRight size={28} color={tool === 'arrow' ? 'var(--accent-yellow)' : 'var(--text-chalk)'} style={{ transform: 'rotate(-45deg)' }} />
            </button>
            <button
              onClick={() => { if (socket && roomId) socket.emit('stroke:clear', { roomId }); }}
              className="tool-btn"
              style={{ padding: '12px', borderRadius: '12px' }}
            >
              <Trash2 size={28} color="var(--accent-red)" />
            </button>

            <div style={{ width: '60%', height: '1px', background: 'rgba(232, 245, 232, 0.1)', margin: '0.5rem 0' }} />

            {/* Color Wheel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'center' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 'bold' }}>Color</div>
              <ColorWheel 
                color={color} 
                onChange={(hex) => { setColor(hex); if (tool === 'eraser') setTool('pen'); }} 
                size={56} 
              />
              <div style={{ 
                width: '32px', height: '12px', borderRadius: '4px', background: color, 
                border: '1px solid rgba(255,255,255,0.2)', boxShadow: `0 0 8px ${color}44` 
              }} />
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

            <div style={{ width: '60%', height: '1px', background: 'rgba(232, 245, 232, 0.1)', margin: '0.5rem 0' }} />

            {/* Elasticity Slider (Flow) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', alignItems: 'center' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 'bold' }}>Flow</div>
              <div style={{ height: '60px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="range" min="0" max="0.8" step="0.1" 
                  value={elasticity} 
                  onChange={(e) => setElasticity(parseFloat(e.target.value))}
                  style={{ 
                    width: '50px', height: '4px', transform: 'rotate(-90deg)', 
                    accentColor: 'var(--accent-yellow)', cursor: 'pointer'
                  }}
                />
              </div>
            </div>
          </aside>
        )}

        {/* Board Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', minWidth: 0 }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <Whiteboard
              isExplainer={isExplainer}
              color={color}
              size={size}
              tool={tool}
              socket={socket}
              roomId={roomId}
              roomState={roomState}
              onToolChange={(t) => setTool(t)}
              elasticity={elasticity}
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
            padding: '0.75rem 1.5rem', borderRadius: '16px'
          }}>
            {isExplainer ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <button
                  onClick={() => setMicActive(!micActive)}
                  style={{
                    width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: micActive ? 'rgba(36, 56, 36, 0.8)' : 'rgba(224, 85, 85, 0.4)',
                    border: micActive ? '2px solid var(--text-chalk)' : '2px solid var(--accent-red)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer'
                  }}
                >
                  {micActive ? <Mic size={24} color="var(--text-chalk)" /> : <MicOff size={24} color="var(--accent-red)" />}
                </button>
                <div>
                  <div style={{ color: 'var(--text-chalk)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {micActive ? 'Microphone Active' : 'Microphone Muted'}
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                    Everyone can hear you explaining!
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', width: '100%', justifyContent: 'center' }}>
                <span style={{ color: 'var(--text-chalk)', fontSize: '1rem', fontWeight: '500' }}>Rate:</span>
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  {[1, 2, 3, 4, 5].map(score => {
                    const hasVoted = roomState.roundScores?.[socket.id] !== undefined;
                    const isSelected = roomState.roundScores?.[socket.id] === score;
                    return (
                      <button
                        key={score}
                        disabled={hasVoted}
                        onClick={() => submitScore(score)}
                        style={{
                          width: '56px', height: '56px', borderRadius: '14px', fontSize: '1.4rem', fontWeight: 'bold',
                          border: isSelected ? '2px solid #ffffff' : '2px solid rgba(232, 245, 232, 0.15)',
                          background: isSelected ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)',
                          color: isSelected ? '#1e2e1e' : 'var(--text-chalk)',
                          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', 
                          cursor: hasVoted ? 'default' : 'pointer',
                          transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                          boxShadow: isSelected ? '0 10px 25px rgba(245, 200, 66, 0.4)' : 'none',
                          opacity: hasVoted && !isSelected ? 0.3 : 1
                        }}
                        onMouseEnter={e => !hasVoted && (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                        onMouseLeave={e => !hasVoted && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
                {roomState.roundScores?.[socket.id] !== undefined && (
                  <div style={{ 
                    background: 'rgba(245, 200, 66, 0.15)', padding: '0.4rem 1rem', borderRadius: '20px',
                    color: 'var(--accent-yellow)', fontSize: '0.85rem', fontWeight: 'bold',
                    border: '1px solid var(--accent-yellow)', animation: 'fadeIn 0.5s ease-out'
                  }}>
                    SCORE SUBMITTED
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Leaderboard + Chat */}
        <aside style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '200px' }}>
            <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(232, 245, 232, 0.1)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <Users size={16} color="var(--accent-yellow)" />
              Leaderboard
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem' }}>
              {[...(roomState.players || [])].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)).map((p, idx) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.8rem', borderRadius: '8px', background: p.id === explainer?.id ? 'rgba(245, 200, 66, 0.12)' : 'transparent', fontSize: '0.85rem' }}>
                  <span style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ color: 'var(--text-dim)', width: '12px' }}>{idx + 1}</span>
                    <span style={{ color: p.id === socket?.id ? 'var(--text-chalk)' : 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  </span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-chalk)' }}>{(p.totalPoints || 0).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '300px' }}>
            <ChatBox socket={socket} roomId={roomId} playerName={playerName} />
          </div>
        </aside>
      </main>
    </div>
  );
}
