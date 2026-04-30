import React, { useRef, useState, useEffect } from 'react';

export default function Whiteboard({ isExplainer, color, size, tool, socket, roomId }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textBoxes, setTextBoxes] = useState([]);

  // All players listen for canvas_clear (also clears text boxes)
  useEffect(() => {
    if (!socket) return;

    const onCanvasClear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1e2e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setTextBoxes([]);
    };

    socket.on('canvas_clear', onCanvasClear);
    return () => socket.off('canvas_clear', onCanvasClear);
  }, [socket]);

  // Sync textboxes with roomState
  useEffect(() => {
    if (roomState?.textBoxes) {
      // Only update if there's a difference to avoid infinite re-renders or focus issues
      if (JSON.stringify(roomState.textBoxes) !== JSON.stringify(textBoxes)) {
        setTextBoxes(roomState.textBoxes);
      }
    }
  }, [roomState?.textBoxes]);

  // All players listen for text box events
  useEffect(() => {
    if (!socket) return;

    const onTextboxAdd = ({ id, x, y, text }) => {
      setTextBoxes(prev => {
        if (prev.find(tb => tb.id === id)) return prev;
        return [...prev, { id, x, y, text }];
      });
    };

    const onTextboxUpdate = ({ id, text }) => {
      setTextBoxes(prev => prev.map(tb => tb.id === id ? { ...tb, text } : tb));
    };

    const onTextboxDelete = ({ id }) => {
      setTextBoxes(prev => prev.filter(tb => tb.id !== id));
    };

    socket.on('textbox:add', onTextboxAdd);
    socket.on('textbox:update', onTextboxUpdate);
    socket.on('textbox:delete', onTextboxDelete);

    return () => {
      socket.off('textbox:add', onTextboxAdd);
      socket.off('textbox:update', onTextboxUpdate);
      socket.off('textbox:delete', onTextboxDelete);
    };
  }, [socket]);

  // Viewers receive stroke replays
  useEffect(() => {
    if (!socket || isExplainer) return;

    const onStrokeReplay = (stroke) => {
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
    };

    socket.on('stroke:replay', onStrokeReplay);
    return () => socket.off('stroke:replay', onStrokeReplay);
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
      stroke: { type, x: x / canvas.width, y: y / canvas.height, color, size, tool }
    });
  };

  const handleTextChange = (id, newText) => {
    setTextBoxes(prev => prev.map(tb => tb.id === id ? { ...tb, text: newText } : tb));
    if (socket && roomId) {
      socket.emit('textbox:update', { roomId, id, text: newText });
    }
  };

  const handleTextDelete = (id) => {
    setTextBoxes(prev => prev.filter(tb => tb.id !== id));
    if (socket && roomId) {
      socket.emit('textbox:delete', { roomId, id });
    }
  };

  const startDrawing = (e) => {
    if (!isExplainer) return;

    if (tool === 'text') {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / canvas.width;
      const y = (e.clientY - rect.top) / canvas.height;
      const id = Math.random().toString(36).slice(2, 9);
      const newBox = { id, x, y, text: '' };
      setTextBoxes(prev => [...prev, newBox]);
      if (socket && roomId) {
        socket.emit('textbox:add', { roomId, id, x, y, text: '' });
      }
      return;
    }

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
    if (tool === 'text') return;
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
    if (tool === 'text') return;
    if (!isDrawing || !isExplainer) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
    emitStroke('stop');
  };

  const handleTouchStart = (e) => {
    if (!isExplainer) return;
    e.preventDefault();
    const touch = e.touches[0];
    startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
  };

  const handleTouchMove = (e) => {
    if (!isExplainer) return;
    e.preventDefault();
    const touch = e.touches[0];
    draw({ clientX: touch.clientX, clientY: touch.clientY });
  };

  const handleTouchEnd = (e) => {
    if (!isExplainer) return;
    e.preventDefault();
    stopDrawing();
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
        cursor: isExplainer ? (tool === 'text' ? 'text' : 'crosshair') : 'default',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
      />

      {!isExplainer && (
        <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
          Viewing Mode
        </div>
      )}

      {/* Text box overlay */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {textBoxes.map(tb => (
          <div
            key={tb.id}
            style={{
              position: 'absolute',
              left: `${tb.x * 100}%`,
              top: `${tb.y * 100}%`,
              transform: 'translate(-2px, -2px)',
              minWidth: '120px',
              maxWidth: '300px',
              pointerEvents: isExplainer ? 'auto' : 'none'
            }}
          >
            {isExplainer ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  onMouseDown={(e) => { e.stopPropagation(); handleTextDelete(tb.id); }}
                  style={{
                    position: 'absolute', top: '-10px', right: '-10px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: '#e05555', color: 'white',
                    fontSize: '14px', lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', cursor: 'pointer', zIndex: 10,
                  }}
                >
                  ×
                </button>
                <textarea
                  autoFocus
                  value={tb.text}
                  onChange={(e) => handleTextChange(tb.id, e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  rows={2}
                  style={{
                    background: 'rgba(255,255,255,0.92)',
                    color: '#1e2e1e',
                    border: '2px solid rgba(30,46,30,0.7)',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontSize: '0.9rem',
                    resize: 'both',
                    minWidth: '120px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.92)',
                color: '#1e2e1e',
                border: '2px solid rgba(30,46,30,0.5)',
                borderRadius: '6px',
                padding: '6px 8px',
                fontSize: '0.9rem',
                whiteSpace: 'pre-wrap',
                minWidth: '120px',
                maxWidth: '300px',
              }}>
                {tb.text || ' '}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
