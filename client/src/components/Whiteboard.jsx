import React, { useRef, useState, useEffect } from 'react';
import { Move } from 'lucide-react';

export default function Whiteboard({ isExplainer, color, size, tool, socket, roomId, roomState, onToolChange, elasticity = 0.3 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const prevPointRef = useRef(null);
  const remotePrevPointRef = useRef(null);
  const shapeStartRef = useRef(null);
  const snapshotRef = useRef(null);
  const lastEmitRef = useRef(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textBoxes, setTextBoxes] = useState([]);

  const SHAPES = ['line', 'rect', 'circle', 'arrow'];

  const drawShape = (ctx, type, x1, y1, x2, y2, color, size) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    if (type === 'line') {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    } else if (type === 'rect') {
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (type === 'circle') {
      const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
    } else if (type === 'arrow') {
      const headlen = size * 3;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const angle = Math.atan2(dy, dx);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    }
    ctx.stroke();
  };

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
    setTextBoxes(roomState?.textBoxes || []);
  }, [roomState?.currentExplainerIndex, roomState?.textBoxes?.length]);

  // All players listen for text box events
  useEffect(() => {
    if (!socket) return;

    const onTextboxAdd = ({ id, x, y, text }) => {
      setTextBoxes(prev => {
        if (prev.find(tb => tb.id === id)) return prev;
        return [...prev, { id, x, y, text }];
      });
    };

    const onTextboxUpdate = ({ id, ...updates }) => {
      setTextBoxes(prev => prev.map(tb => tb.id === id ? { ...tb, ...updates } : tb));
    };

    const onTextboxDelete = ({ id }) => {
      setTextBoxes(prev => prev.filter(tb => tb.id !== id));
    };

    const onShapeReplay = ({ type, x1, y1, x2, y2, color, size }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      drawShape(ctx, type, x1 * canvas.width, y1 * canvas.height, x2 * canvas.width, y2 * canvas.height, color, size);
    };

    socket.on('textbox:add', onTextboxAdd);
    socket.on('textbox:update', onTextboxUpdate);
    socket.on('textbox:delete', onTextboxDelete);
    socket.on('shape:replay', onShapeReplay);

    return () => {
      socket.off('textbox:add', onTextboxAdd);
      socket.off('textbox:update', onTextboxUpdate);
      socket.off('textbox:delete', onTextboxDelete);
      socket.off('shape:replay', onShapeReplay);
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
        remotePrevPointRef.current = { x, y };
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (stroke.type === 'draw') {
        if (!remotePrevPointRef.current) remotePrevPointRef.current = { x, y };
        const midX = remotePrevPointRef.current.x + (x - remotePrevPointRef.current.x) / 2;
        const midY = remotePrevPointRef.current.y + (y - remotePrevPointRef.current.y) / 2;
        
        ctx.strokeStyle = stroke.tool === 'eraser' ? '#1e2e1e' : stroke.color;
        ctx.lineWidth = stroke.tool === 'eraser' ? stroke.size * 3 : stroke.size;
        
        ctx.quadraticCurveTo(remotePrevPointRef.current.x, remotePrevPointRef.current.y, midX, midY);
        ctx.stroke();
        remotePrevPointRef.current = { x, y };
      } else if (stroke.type === 'stop') {
        ctx.closePath();
        remotePrevPointRef.current = null;
      }
    };

    socket.on('stroke:replay', onStrokeReplay);
    return () => socket.off('stroke:replay', onStrokeReplay);
  }, [socket, isExplainer]);

  // Set up canvas context and scaling with ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const newW = rect.width;
      const newH = rect.width * (9 / 16);
      
      if (newW === 0 || (newW === canvas.width && newH === canvas.height)) return;

      // Snapshot existing content
      const snapshot = canvas.toDataURL();
      
      canvas.width = newW;
      canvas.height = newH;

      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#1e2e1e';
      ctx.fillRect(0, 0, newW, newH);

      // Restore snapshot
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, newW, newH);
      };
      img.src = snapshot;
    };

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(container);
    updateSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const emitStroke = (type, x, y) => {
    if (!socket || !roomId) return;
    const canvas = canvasRef.current;
    socket.emit('stroke:draw', {
      roomId,
      stroke: { type, x: x / canvas.width, y: y / canvas.height, color, size, tool }
    });
  };

  const handleTextUpdate = (id, updates) => {
    setTextBoxes(prev => prev.map(tb => tb.id === id ? { ...tb, ...updates } : tb));
    if (socket && roomId) {
      socket.emit('textbox:update', { roomId, id, ...updates });
    }
  };

  const handleTextDelete = (id) => {
    setTextBoxes(prev => prev.filter(tb => tb.id !== id));
    if (socket && roomId) {
      socket.emit('textbox:delete', { roomId, id });
    }
  };

  const handleTextDrag = (e, id) => {
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const tb = textBoxes.find(t => t.id === id);
    if (!tb) return;
    
    const initialX = tb.x;
    const initialY = tb.y;
    const canvas = canvasRef.current;

    const onMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / canvas.width;
      const dy = (moveEvent.clientY - startY) / canvas.height;
      handleTextUpdate(id, { x: initialX + dx, y: initialY + dy });
    };

    const onUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
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
      if (onToolChange) onToolChange('pen');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (SHAPES.includes(tool)) {
      shapeStartRef.current = { x, y };
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
      prevPointRef.current = { x, y };
      ctx.beginPath();
      ctx.moveTo(x, y);
      emitStroke('start', x, y);
    }
    
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (tool === 'text') return;
    if (!isDrawing || !isExplainer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    if (SHAPES.includes(tool)) {
      if (!snapshotRef.current) return;
      ctx.putImageData(snapshotRef.current, 0, 0);
      drawShape(ctx, tool, shapeStartRef.current.x, shapeStartRef.current.y, rawX, rawY, color, size);
      return;
    }

    if (!prevPointRef.current) prevPointRef.current = { x: rawX, y: rawY };
    
    // EMA Smoothing
    const x = prevPointRef.current.x + (rawX - prevPointRef.current.x) * (1 - elasticity);
    const y = prevPointRef.current.y + (rawY - prevPointRef.current.y) * (1 - elasticity);
    const midX = prevPointRef.current.x + (x - prevPointRef.current.x) / 2;
    const midY = prevPointRef.current.y + (y - prevPointRef.current.y) / 2;

    if (tool === 'eraser') {
      ctx.strokeStyle = '#1e2e1e';
      ctx.lineWidth = size * 3;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }

    ctx.quadraticCurveTo(prevPointRef.current.x, prevPointRef.current.y, midX, midY);
    ctx.stroke();
    prevPointRef.current = { x, y };

    // 10ms throttle for emission
    const now = Date.now();
    if (now - lastEmitRef.current > 10) {
      emitStroke('draw', x, y);
      lastEmitRef.current = now;
    }
  };

  const stopDrawing = (e) => {
    if (tool === 'text') return;
    if (!isDrawing || !isExplainer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (SHAPES.includes(tool) && shapeStartRef.current) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || e.changedTouches?.[0]?.clientX) - rect.left;
      const y = (e.clientY || e.changedTouches?.[0]?.clientY) - rect.top;
      
      // Final draw
      if (snapshotRef.current) ctx.putImageData(snapshotRef.current, 0, 0);
      drawShape(ctx, tool, shapeStartRef.current.x, shapeStartRef.current.y, x, y, color, size);

      if (socket && roomId) {
        socket.emit('shape:draw', {
          roomId,
          type: tool,
          x1: shapeStartRef.current.x / canvas.width,
          y1: shapeStartRef.current.y / canvas.height,
          x2: x / canvas.width,
          y2: y / canvas.height,
          color,
          size
        });
      }
      shapeStartRef.current = null;
      snapshotRef.current = null;
    } else {
      ctx.closePath();
      emitStroke('stop');
    }

    setIsDrawing(false);
    prevPointRef.current = null;
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
    <div className="chalkboard-frame" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          border: 'var(--border-chalk)',
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)',
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
        {(textBoxes || []).map(tb => (
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
                <div 
                  onPointerDown={(e) => handleTextDrag(e, tb.id)}
                  style={{
                    position: 'absolute', top: '-10px', left: '-10px',
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'var(--accent-blue)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'grab', zIndex: 10, border: '2px solid white',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                  }}
                >
                  <Move size={14} />
                </div>
                <textarea
                  autoFocus
                  value={tb.text}
                  onChange={(e) => handleTextUpdate(tb.id, { text: e.target.value })}
                  onMouseUp={(e) => {
                    const { offsetWidth, offsetHeight } = e.target;
                    if (offsetWidth !== tb.width || offsetHeight !== tb.height) {
                      handleTextUpdate(tb.id, { width: offsetWidth, height: offsetHeight });
                    }
                  }}
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
                    width: tb.width ? `${tb.width}px` : 'auto',
                    height: tb.height ? `${tb.height}px` : 'auto',
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
                width: tb.width ? `${tb.width}px` : 'auto',
                height: tb.height ? `${tb.height}px` : 'auto',
              }}>
                {tb.text || ' '}
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
