import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Move } from 'lucide-react';

const BG_COLOR = '#1e2e1e';
const SHAPES = ['line', 'rect', 'circle', 'arrow'];

// Renders a single stroke from its normalized point list. Used for both live
// drawing during the user's gesture and full-canvas redraws on resize/replay.
function renderStroke(ctx, stroke, w, h) {
  if (!stroke?.points?.length) return;
  const pts = stroke.points;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.tool === 'eraser' ? BG_COLOR : (stroke.color || '#e8f5e8');
  ctx.lineWidth = (stroke.tool === 'eraser' ? stroke.size * 3 : stroke.size) || 3;

  ctx.beginPath();
  const first = pts[0];
  ctx.moveTo(first.x * w, first.y * h);
  if (pts.length === 1) {
    // Render single tap as a small dot
    ctx.arc(first.x * w, first.y * h, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const next = pts[i + 1];
      const midX = (p.x + next.x) / 2;
      const midY = (p.y + next.y) / 2;
      ctx.quadraticCurveTo(p.x * w, p.y * h, midX * w, midY * h);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x * w, last.y * h);
    ctx.stroke();
  }
  ctx.restore();
}

function renderShape(ctx, shape, w, h) {
  const { type, x1, y1, x2, y2, color, size } = shape;
  ctx.save();
  ctx.strokeStyle = color || '#e8f5e8';
  ctx.lineWidth = size || 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const X1 = x1 * w, Y1 = y1 * h, X2 = x2 * w, Y2 = y2 * h;

  if (type === 'line') {
    ctx.moveTo(X1, Y1);
    ctx.lineTo(X2, Y2);
  } else if (type === 'rect') {
    ctx.strokeRect(X1, Y1, X2 - X1, Y2 - Y1);
    ctx.restore();
    return;
  } else if (type === 'circle') {
    const radius = Math.hypot(X2 - X1, Y2 - Y1);
    ctx.arc(X1, Y1, radius, 0, Math.PI * 2);
  } else if (type === 'arrow') {
    const head = (size || 3) * 3;
    const angle = Math.atan2(Y2 - Y1, X2 - X1);
    ctx.moveTo(X1, Y1);
    ctx.lineTo(X2, Y2);
    ctx.lineTo(X2 - head * Math.cos(angle - Math.PI / 6), Y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(X2, Y2);
    ctx.lineTo(X2 - head * Math.cos(angle + Math.PI / 6), Y2 - head * Math.sin(angle + Math.PI / 6));
  }
  ctx.stroke();
  ctx.restore();
}

export default function Whiteboard({
  isExplainer,
  color,
  size,
  tool,
  socket,
  roomId,
  roomState,
  onToolChange,
  elasticity = 0.3,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const strokesRef = useRef([]);
  const shapesRef = useRef([]);
  const liveStrokeRef = useRef(null);
  const shapeStartRef = useRef(null);
  const shapePreviewRef = useRef(null);
  const lastEmitRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const [isDrawing, setIsDrawing] = useState(false);
  const [textBoxes, setTextBoxes] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // Re-render the entire canvas from the strokes/shapes vector. Cheap on modern
  // hardware for typical session lengths and gives us a single source of truth.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    for (const stroke of strokesRef.current) renderStroke(ctx, stroke, w, h);
    for (const shape of shapesRef.current) renderShape(ctx, shape, w, h);

    // Live shape preview during a drag (rect/circle/arrow/line)
    if (shapePreviewRef.current) renderShape(ctx, shapePreviewRef.current, w, h);
  }, []);

  // ResizeObserver: replay the vector when the canvas pixel size changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const newW = Math.round(rect.width);
      const newH = Math.round(rect.width * (9 / 16));
      if (newW === 0) return;
      if (newW === sizeRef.current.w && newH === sizeRef.current.h) return;

      canvas.width = newW;
      canvas.height = newH;
      sizeRef.current = { w: newW, h: newH };
      setCanvasSize({ w: newW, h: newH });
      redraw();
    };

    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    updateSize();

    return () => ro.disconnect();
  }, [redraw]);

  // canvas_clear: drop all vectors and repaint.
  useEffect(() => {
    if (!socket) return;
    const onClear = () => {
      strokesRef.current = [];
      shapesRef.current = [];
      liveStrokeRef.current = null;
      shapePreviewRef.current = null;
      setTextBoxes([]);
      redraw();
    };
    socket.on('canvas_clear', onClear);
    return () => socket.off('canvas_clear', onClear);
  }, [socket, redraw]);

  // Mid-join replay — the server sends the full board state in two places:
  // (a) a dedicated `board:replay` event right after join, and
  // (b) on every `room_state_update` (room.strokes/shapes/textBoxes are part
  //     of the room object). We use (b) as the canonical source so a
  //     mid-joiner that mounts *after* (a) has fired still hydrates correctly.
  useEffect(() => {
    if (!roomState) return;
    if (Array.isArray(roomState.strokes)) {
      strokesRef.current = roomState.strokes;
    }
    if (Array.isArray(roomState.shapes)) {
      shapesRef.current = roomState.shapes;
    }
    setTextBoxes(roomState.textBoxes || []);
    redraw();
    requestAnimationFrame(() => redraw());
  }, [roomState?.currentExplainerIndex, roomState?.roundId, redraw]);

  // Belt-and-suspenders: also handle the explicit board:replay socket event.
  // (No-op once room_state_update has hydrated, but covers some edge cases.)
  useEffect(() => {
    if (!socket) return;
    const onReplay = ({ strokes, shapes, textBoxes: tbs }) => {
      strokesRef.current = Array.isArray(strokes) ? strokes : [];
      shapesRef.current = Array.isArray(shapes) ? shapes : [];
      setTextBoxes(Array.isArray(tbs) ? tbs : []);
      redraw();
      requestAnimationFrame(() => redraw());
    };
    socket.on('board:replay', onReplay);
    return () => socket.off('board:replay', onReplay);
  }, [socket, redraw]);

  // Listen for textbox sync events from peers.
  useEffect(() => {
    if (!socket) return;
    const onAdd = (tb) => {
      setTextBoxes((prev) => (prev.find((t) => t.id === tb.id) ? prev : [...prev, tb]));
    };
    const onUpdate = (update) => {
      setTextBoxes((prev) => prev.map((tb) => (tb.id === update.id ? { ...tb, ...update } : tb)));
    };
    const onDelete = ({ id }) => {
      setTextBoxes((prev) => prev.filter((tb) => tb.id !== id));
    };
    const onShape = (shape) => {
      shapesRef.current.push(shape);
      redraw();
    };
    socket.on('textbox:add', onAdd);
    socket.on('textbox:update', onUpdate);
    socket.on('textbox:delete', onDelete);
    socket.on('shape:replay', onShape);
    return () => {
      socket.off('textbox:add', onAdd);
      socket.off('textbox:update', onUpdate);
      socket.off('textbox:delete', onDelete);
      socket.off('shape:replay', onShape);
    };
  }, [socket, redraw]);

  // Stroke replay from peers (non-explainer view).
  useEffect(() => {
    if (!socket || isExplainer) return;
    const onStroke = (stroke) => {
      const list = strokesRef.current;
      if (stroke.type === 'start') {
        list.push({
          id: Math.random().toString(36).slice(2, 10),
          color: stroke.color,
          size: stroke.size,
          tool: stroke.tool,
          points: [{ x: stroke.x, y: stroke.y }],
        });
      } else if (stroke.type === 'draw') {
        const last = list[list.length - 1];
        if (last) last.points.push({ x: stroke.x, y: stroke.y });
      }
      redraw();
    };
    socket.on('stroke:replay', onStroke);
    return () => socket.off('stroke:replay', onStroke);
  }, [socket, isExplainer, redraw]);

  // Cursor position from a mouse/touch event in normalized coordinates.
  const eventToNorm = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    const cy = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top;
    return {
      x: Math.min(Math.max(cx / rect.width, 0), 1),
      y: Math.min(Math.max(cy / rect.height, 0), 1),
    };
  };

  const emitStroke = (type, x, y) => {
    if (!socket || !roomId) return;
    socket.emit('stroke:draw', { roomId, stroke: { type, x, y, color, size, tool } });
  };

  // ── Drawing handlers ────────────────────────────────────────────────────────
  const startDrawing = (e) => {
    if (!isExplainer) return;

    const norm = eventToNorm(e);

    if (tool === 'text') {
      const id = Math.random().toString(36).slice(2, 9);
      const newBox = { id, x: norm.x, y: norm.y, text: '' };
      setTextBoxes((prev) => [...prev, newBox]);
      socket?.emit('textbox:add', { roomId, id, x: norm.x, y: norm.y, text: '' });
      onToolChange?.('pen');
      return;
    }

    if (SHAPES.includes(tool)) {
      shapeStartRef.current = norm;
      shapePreviewRef.current = { type: tool, x1: norm.x, y1: norm.y, x2: norm.x, y2: norm.y, color, size };
      setIsDrawing(true);
      return;
    }

    // Pen / eraser — start a new stroke
    const stroke = {
      id: Math.random().toString(36).slice(2, 10),
      color,
      size,
      tool,
      points: [norm],
    };
    liveStrokeRef.current = stroke;
    strokesRef.current.push(stroke);
    emitStroke('start', norm.x, norm.y);
    setIsDrawing(true);
    redraw();
  };

  const draw = (e) => {
    if (!isDrawing || !isExplainer) return;
    const norm = eventToNorm(e);

    if (SHAPES.includes(tool)) {
      shapePreviewRef.current = { type: tool, x1: shapeStartRef.current.x, y1: shapeStartRef.current.y, x2: norm.x, y2: norm.y, color, size };
      redraw();
      return;
    }

    const stroke = liveStrokeRef.current;
    if (!stroke) return;
    const prev = stroke.points[stroke.points.length - 1];

    // Elasticity smoothing applied to point coordinates before append.
    const sx = prev.x + (norm.x - prev.x) * (1 - elasticity);
    const sy = prev.y + (norm.y - prev.y) * (1 - elasticity);
    stroke.points.push({ x: sx, y: sy });

    redraw();

    const now = Date.now();
    if (now - lastEmitRef.current > 16) {
      emitStroke('draw', sx, sy);
      lastEmitRef.current = now;
    }
  };

  const stopDrawing = (e) => {
    if (!isExplainer) return;

    if (SHAPES.includes(tool) && shapeStartRef.current && shapePreviewRef.current) {
      const norm = e ? eventToNorm(e) : { x: shapePreviewRef.current.x2, y: shapePreviewRef.current.y2 };
      const shape = {
        type: tool,
        x1: shapeStartRef.current.x,
        y1: shapeStartRef.current.y,
        x2: norm.x,
        y2: norm.y,
        color,
        size,
      };
      shapesRef.current.push(shape);
      shapePreviewRef.current = null;
      shapeStartRef.current = null;
      socket?.emit('shape:draw', { roomId, ...shape });
      redraw();
    } else if (liveStrokeRef.current) {
      emitStroke('stop');
      liveStrokeRef.current = null;
    }

    setIsDrawing(false);
  };

  // ── Touch handlers ──────────────────────────────────────────────────────────
  const handleTouchStart = (e) => { e.preventDefault(); startDrawing({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }); };
  const handleTouchMove = (e) => { e.preventDefault(); draw({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }); };
  const handleTouchEnd = (e) => { e.preventDefault(); stopDrawing(e.changedTouches?.[0] ? { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY } : null); };

  // ── Textbox handlers ────────────────────────────────────────────────────────
  const updateTextbox = (id, updates) => {
    setTextBoxes((prev) => prev.map((tb) => (tb.id === id ? { ...tb, ...updates } : tb)));
    socket?.emit('textbox:update', { roomId, id, ...updates });
  };

  const deleteTextbox = (id) => {
    setTextBoxes((prev) => prev.filter((tb) => tb.id !== id));
    socket?.emit('textbox:delete', { roomId, id });
  };

  const handleTextDrag = (e, id) => {
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const tb = textBoxes.find((t) => t.id === id);
    if (!tb) return;
    const initialX = tb.x;
    const initialY = tb.y;
    const canvas = canvasRef.current;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / canvas.width;
      const dy = (ev.clientY - startY) / canvas.height;
      updateTextbox(id, { x: initialX + dx, y: initialY + dy });
    };

    const onUp = () => {
      try { target.releasePointerCapture(e.pointerId); } catch (_) { /* may already be released */ }
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };

  // Throttled live resize sync — so the other side actually sees you resize.
  const lastResizeEmitRef = useRef(0);
  const handleTextareaResize = (id, el) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const now = Date.now();
    if (now - lastResizeEmitRef.current < 60) return;
    lastResizeEmitRef.current = now;

    const widthN = el.offsetWidth / canvas.width;
    const heightN = el.offsetHeight / canvas.height;
    updateTextbox(id, { width: widthN, height: heightN });
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
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
        />

        {!isExplainer && (
          <div style={{
            position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.5)',
            padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem',
          }}>
            Viewing Mode
          </div>
        )}

        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {(textBoxes || []).map((tb) => {
            const widthPx = tb.width && canvasSize.w ? tb.width * canvasSize.w : undefined;
            const heightPx = tb.height && canvasSize.h ? tb.height * canvasSize.h : undefined;

            return (
              <div
                key={tb.id}
                style={{
                  position: 'absolute',
                  left: `${tb.x * 100}%`,
                  top: `${tb.y * 100}%`,
                  transform: 'translate(-2px, -2px)',
                  minWidth: '120px',
                  maxWidth: '320px',
                  pointerEvents: isExplainer ? 'auto' : 'none',
                }}
              >
                {isExplainer ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      onMouseDown={(e) => { e.stopPropagation(); deleteTextbox(tb.id); }}
                      style={{
                        position: 'absolute', top: '-10px', right: '-10px',
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: 'var(--accent-red)', color: 'white',
                        fontSize: '14px', lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', cursor: 'pointer', zIndex: 10,
                      }}
                      title="Delete"
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
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                      }}
                      title="Drag to move"
                    >
                      <Move size={14} />
                    </div>
                    <textarea
                      autoFocus
                      value={tb.text || ''}
                      onChange={(e) => updateTextbox(tb.id, { text: e.target.value })}
                      onMouseUp={(e) => handleTextareaResize(tb.id, e.target)}
                      onMouseMove={(e) => { if (e.buttons === 1) handleTextareaResize(tb.id, e.target); }}
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
                        width: widthPx ? `${widthPx}px` : 'auto',
                        height: heightPx ? `${heightPx}px` : 'auto',
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
                    maxWidth: '320px',
                    width: widthPx ? `${widthPx}px` : 'auto',
                    height: heightPx ? `${heightPx}px` : 'auto',
                  }}>
                    {tb.text || ' '}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
