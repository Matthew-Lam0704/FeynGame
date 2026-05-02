import React, { useRef, useEffect, useState } from 'react';

export default function ColorWheel({ color, onChange, size = 100 }) {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const radius = size / 2;
    const cx = radius;
    const cy = radius;

    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 2) * Math.PI / 180;
      const endAngle = angle * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(1, `hsl(${angle}, 100%, 50%)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }, [size]);

  const handlePick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const radius = size / 2;
    const dx = x - radius;
    const dy = y - radius;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= radius) {
      const angle = Math.atan2(dy, dx) * 180 / Math.PI + 180;
      const saturation = Math.min(100, (distance / radius) * 100);
      const hex = hslToHex(angle, saturation, 50);
      onChange(hex);
    }
  };

  const hslToHex = (h, s, l) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  return (
    <div style={{ position: 'relative', width: size, height: size, cursor: 'crosshair' }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        onMouseDown={(e) => { setIsDragging(true); handlePick(e); }}
        onMouseMove={(e) => { if (isDragging) handlePick(e); }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        style={{ borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
      />
      {/* Current color indicator/swatch */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '12px', height: '12px', borderRadius: '50%', background: color,
        border: '2px solid white', boxShadow: '0 0 5px rgba(0,0,0,0.5)', pointerEvents: 'none'
      }} />
    </div>
  );
}
