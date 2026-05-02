import React, { useRef, useState, useEffect } from 'react';
import { Volume2 } from 'lucide-react';

export default function VolumeSlider({ value, onChange }) {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef(null);

  const updateVolume = (clientX) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    onChange(Math.round(percent * 100));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    updateVolume(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) updateVolume(e.clientX);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div 
        ref={trackRef}
        onMouseDown={handleMouseDown}
        style={{
          width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px', cursor: 'pointer', position: 'relative'
        }}
      >
        {/* Fill */}
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${value}%`, background: 'var(--accent-yellow)',
          borderRadius: '4px', transition: isDragging ? 'none' : 'width 0.1s',
          boxShadow: '0 0 10px rgba(245, 200, 66, 0.4)'
        }} />
        
        {/* Thumb */}
        <div style={{
          position: 'absolute', top: '50%', left: `${value}%`,
          transform: 'translate(-50%, -50%)', width: '20px', height: '20px',
          background: 'var(--text-chalk)', borderRadius: '50%',
          border: '2px solid var(--accent-yellow)', cursor: 'grab',
          boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
          transition: isDragging ? 'none' : 'left 0.1s',
        }} />
      </div>
    </div>
  );
}
