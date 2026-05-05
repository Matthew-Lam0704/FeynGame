import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Play, Info, Mic, Pencil } from 'lucide-react';

const SLIDES = [
  {
    title: "Welcome to Chalkmate",
    content: "The study tool built around the Feynman Technique: if you can't explain it simply, you don't understand it well enough.",
    icon: <Info size={48} color="var(--accent-yellow)" />,
    color: "var(--accent-yellow)"
  },
  {
    title: "Teach to Learn",
    content: "One player explains; the rest learn and rate. The shared whiteboard and voice channel turn any topic into a 90-second mini-lesson.",
    icon: <Mic size={48} color="var(--accent-blue)" />,
    color: "var(--accent-blue)"
  },
  {
    title: "Draw it Out",
    content: "Pen, eraser, shapes, text and a real color wheel. Your strokes sync live so the whole class sees what you draw.",
    icon: <Pencil size={48} color="var(--accent-red)" />,
    color: "var(--accent-red)"
  },
  {
    title: "Earn & Unlock",
    content: "Strong explanations earn coins. Spend them on avatar frames and (soon) exclusive content packs.",
    icon: <Play size={48} color="var(--text-chalk)" />,
    color: "var(--text-chalk)"
  }
];

export default function OnboardingModal({ onComplete }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      localStorage.setItem('chalkmate_onboarded', 'true');
      // Keep the legacy key around so users who already onboarded under the old name don't see this again
      localStorage.setItem('feyn_onboarded', 'true');
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) setCurrentSlide(s => s - 1);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)'
    }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel"
        style={{
          width: '90%', maxWidth: '500px', padding: '3rem', textAlign: 'center',
          position: 'relative', overflow: 'hidden'
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ 
              width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem',
              boxShadow: `0 0 30px ${SLIDES[currentSlide].color}22`,
              border: `1px solid ${SLIDES[currentSlide].color}44`
            }}>
              {SLIDES[currentSlide].icon}
            </div>
            
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', fontFamily: 'var(--font-serif)', color: SLIDES[currentSlide].color }}>
              {SLIDES[currentSlide].title}
            </h2>
            
            <p style={{ fontSize: '1.1rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              {SLIDES[currentSlide].content}
            </p>
          </motion.div>
        </AnimatePresence>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '2rem 0' }}>
          {SLIDES.map((_, i) => (
            <div 
              key={i} 
              style={{ 
                width: i === currentSlide ? '24px' : '8px', height: '8px', borderRadius: '4px',
                background: i === currentSlide ? SLIDES[currentSlide].color : 'rgba(255,255,255,0.1)',
                transition: 'all 0.3s ease'
              }} 
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={handlePrev}
            disabled={currentSlide === 0}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--text-dim)', 
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
              visibility: currentSlide === 0 ? 'hidden' : 'visible'
            }}
          >
            <ChevronLeft size={20} /> Back
          </button>
          
          <button 
            onClick={handleNext}
            className="btn btn-primary"
            style={{ 
              padding: '0.8rem 2rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px',
              background: currentSlide === SLIDES.length - 1 ? 'var(--accent-yellow)' : 'white',
              color: currentSlide === SLIDES.length - 1 ? 'black' : 'black'
            }}
          >
            {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'} 
            {currentSlide < SLIDES.length - 1 && <ChevronRight size={20} />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
