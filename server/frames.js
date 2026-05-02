// Server-side frame catalog. Mirrors client/src/lib/frames.js but only carries
// the fields the server cares about — id and price — so price validation lives
// in one place and can't be tampered with by the client.

const FRAMES = [
  { id: 'none',         price: 0    },
  { id: 'gold-ring',    price: 100  },
  { id: 'crimson-glow', price: 250  },
  { id: 'ocean-pulse',  price: 400  },
  { id: 'aurora',       price: 600  },
  { id: 'sunset',       price: 800  },
  { id: 'royal-velvet', price: 1200 },
  { id: 'holo',         price: 2000 },
];

const FRAMES_BY_ID = new Map(FRAMES.map((f) => [f.id, f]));

const getFrame = (id) => FRAMES_BY_ID.get(id) ?? null;

module.exports = { FRAMES, getFrame };
