import React from 'react';
import { getFrame } from '../lib/frames';
import '../styles/avatar-frames.css';

// Frames whose visual is a CSS gradient *background* need padding so the inner
// image doesn't cover the ring. Frames that use border/box-shadow alone don't.
const NEEDS_RING_PADDING = new Set(['aurora', 'sunset', 'holo']);

export default function AvatarFrame({ src, size = 44, frameId, alt = 'Avatar' }) {
  const frame = getFrame(frameId) ?? getFrame('none');
  const className = [
    'avatar-frame',
    `frame-${frame.id}`,
    NEEDS_RING_PADDING.has(frame.id) ? 'has-ring' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className} style={{ width: size, height: size }}>
      <img src={src} alt={alt} />
    </div>
  );
}
