import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

export default function ChatBox({ socket, roomId, playerName }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg) => {
      setMessages(prev => [...prev.slice(-49), msg]); // Keep last 50
    };

    socket.on('chat:message', onMessage);
    return () => socket.off('chat:message', onMessage);
  }, [socket]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    socket.emit('chat:message', { roomId, playerName, text: inputText });
    setInputText('');
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px',
      border: '1px solid rgba(232, 245, 232, 0.1)', overflow: 'hidden'
    }}>
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, padding: '1rem', overflowY: 'auto', 
          display: 'flex', flexDirection: 'column', gap: '0.6rem' 
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto', opacity: 0.5 }}>
            Say something simple...
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
              <span style={{ fontWeight: 'bold', color: m.playerName === playerName ? 'var(--accent-yellow)' : 'var(--text-chalk)' }}>
                {m.playerName}:
              </span>
              <span style={{ color: 'var(--text-dim)', marginLeft: '0.5rem', wordBreak: 'break-word' }}>
                {m.text}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} style={{ 
        padding: '0.75rem', borderTop: '1px solid rgba(232, 245, 232, 0.1)',
        display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)'
      }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(232,245,232,0.2)',
            borderRadius: '6px', padding: '0.5rem 0.8rem', color: 'var(--text-chalk)', fontSize: '0.9rem',
            outline: 'none'
          }}
        />
        <button type="submit" style={{
          background: 'var(--accent-yellow)', border: 'none', borderRadius: '6px',
          width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#1e2e1e'
        }}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
