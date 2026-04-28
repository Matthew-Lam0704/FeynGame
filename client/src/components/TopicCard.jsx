import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TopicCard({ topic, subject }) {
  if (!topic) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={topic}
        initial={{ y: -100, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -50, opacity: 0, scale: 0.9 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          delay: 0.5 
        }}
        className="topic-card-container"
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          pointerEvents: 'none'
        }}
      >
        <div style={{
          background: 'rgba(30, 46, 30, 0.95)',
          padding: '1.5rem 3rem',
          borderRadius: '4px',
          border: '2px solid var(--text-chalk)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(232, 245, 232, 0.05)',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
          minWidth: '300px'
        }}>
          <div style={{ 
            color: 'var(--text-dim)', 
            fontSize: '0.9rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.2em',
            marginBottom: '0.5rem'
          }}>
            Explain the concept of:
          </div>
          <h1 style={{ 
            fontFamily: 'var(--font-serif)', 
            fontSize: '2.5rem', 
            color: 'var(--accent-yellow)',
            margin: 0,
            textShadow: '2px 2px 0px rgba(0,0,0,0.5)'
          }}>
            {topic}
          </h1>
          <div style={{ 
            marginTop: '0.5rem',
            fontSize: '0.8rem',
            color: 'var(--text-dim)',
            fontStyle: 'italic'
          }}>
            Subject: {subject}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
