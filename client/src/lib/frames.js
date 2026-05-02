// Avatar frame catalog. Mirrors server/frames.js — keep ids and prices in sync.
// Visual styling is applied via the matching `.frame-<id>` class in
// avatar-frames.css; this file is the source of truth for what shows up in the
// shop UI (name, description, price).

export const FRAMES = [
  {
    id: 'none',
    name: 'No Frame',
    price: 0,
    description: 'The classic look.',
  },
  {
    id: 'gold-ring',
    name: 'Gold Ring',
    price: 100,
    description: 'A solid gold border. Steady and proud.',
  },
  {
    id: 'crimson-glow',
    name: 'Crimson Glow',
    price: 250,
    description: 'A red border with a soft outer glow.',
  },
  {
    id: 'ocean-pulse',
    name: 'Ocean Pulse',
    price: 400,
    description: 'A pulsing blue halo.',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    price: 600,
    description: 'A slow-spinning conic gradient.',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    price: 800,
    description: 'A warm orange-to-pink gradient ring.',
  },
  {
    id: 'royal-velvet',
    name: 'Royal Velvet',
    price: 1200,
    description: 'Deep purple with shifting gold highlights.',
  },
  {
    id: 'holo',
    name: 'Holographic',
    price: 2000,
    description: 'A shifting holographic shimmer for the elite.',
  },
];

export const FRAMES_BY_ID = new Map(FRAMES.map((f) => [f.id, f]));

export const getFrame = (id) => FRAMES_BY_ID.get(id) ?? null;
