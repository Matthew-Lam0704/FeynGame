import React, { useRef, useState, useEffect } from 'react';

export default function Whiteboard({ isExplainer, color, size, tool, socket, roomId }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Sync logic for audience
  useEffect(() => {
    if (!socket || isExplainer) return;

    socket.on('stroke:replay', (stroke) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      const x = stroke.x * canvas.width;
      const y = stroke.y * canvas.height;

      if (stroke.type === 'start') {
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (stroke.type === 'draw') {
        ctx.strokeStyle = stroke.tool === 'eraser' ? '#1e2e1e' : stroke.color;
        ctx.lineWidth = stroke.tool === 'eraser' ? stroke.size * 3 : stroke.size;
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (stroke.type === 'stop') {
        ctx.closePath();
      }
    });

    socket.on('canvas_clear', () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1e2e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off('stroke:replay');
      socket.off('canvas_clear');
    };
  }, [socket, isExplainer]);

  // Set up canvas context and scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.width * (9 / 16);
      
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#1e2e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const emitStroke = (type, x, y) => {
    if (!socket || !roomId) return;
    const canvas = canvasRef.current;
    socket.emit('stroke:draw', {
      roomId,
      stroke: {
        type,
        x: x / canvas.width,
        y: y / canvas.height,
        color,
        size,
        tool
      }
    });
  };

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
    emitStroke('start', x, y);
  };

  const draw = (e) => {
    if (!isDrawing || !isExplainer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'eraser') {
      ctx.strokeStyle = '#1e2e1e';
      ctx.lineWidth = size * 3;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    emitStroke('draw', x, y);
  };

  const stopDrawing = () => {
    if (!isDrawing || !isExplainer) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
    emitStroke('stop');
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
