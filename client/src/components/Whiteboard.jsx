import React, { useRef, useState, useEffect } from 'react';

export default function Whiteboard({ isExplainer, color, size, tool }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Set up canvas context and scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Fixed aspect ratio 16:9
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.width * (9 / 16);
      
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Fill with dark chalkboard color
      ctx.fillStyle = '#1e2e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const startDrawing = (e) => {
    if (!isExplainer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);

    // In future: emit socket event start
  };

  const draw = (e) => {
    if (!isDrawing || !isExplainer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'eraser') {
      ctx.strokeStyle = '#1e2e1e'; // Background color
      ctx.lineWidth = size * 3; // Eraser is bigger
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }

    ctx.lineTo(x, y);
    ctx.stroke();

    // In future: emit socket event move
  };

  const stopDrawing = () => {
    if (!isDrawing || !isExplainer) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);

    // In future: emit socket event end
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        border: 'var(--border-chalk)', 
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        cursor: isExplainer ? 'crosshair' : 'default'
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />
      
      {!isExplainer && (
        <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
          Viewing Mode
        </div>
      )}
    </div>
  );
}
