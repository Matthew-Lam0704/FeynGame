const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { AccessToken } = require('livekit-server-sdk');
const { createRoom, getRoom, deleteRoom, getAllRooms } = require('./rooms');
const { startNextRound } = require('./gameLoop');

const { createClient } = require('@supabase/supabase-js');

// Supabase admin client (optional — only for account deletion)
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// Fail fast if credentials are missing — do not run with insecure defaults
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('FATAL: LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
  process.exit(1);
}

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 3001;

const app = express();

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Rate limiters
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const roomLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many rooms created, please try again later.' },
});

app.post('/rooms', roomLimiter, (req, res) => {
  const { roomId, name, isPublic, maxPlayers } = req.body;
  if (typeof roomId !== 'string' || !/^[A-Z0-9]{1,20}$/.test(roomId)) {
    return res.status(400).json({ error: 'Invalid roomId' });
  }
  const safeName = typeof name === 'string' ? name.slice(0, 50).trim() : roomId;
  const safePublic = typeof isPublic === 'boolean' ? isPublic : false;
  const safeMax = Number.isInteger(maxPlayers) && maxPlayers >= 2 && maxPlayers <= 8
    ? maxPlayers : 4;

  if (!getRoom(roomId)) {
    createRoom(roomId, { name: safeName, isPublic: safePublic, maxPlayers: safeMax });
  }
  res.json({ roomId });
});

app.get('/rooms', (_req, res) => {
  const publicRooms = [];
  getAllRooms().forEach((room) => {
    if (room.isPublic && room.status === 'lobby') {
      publicRooms.push({
        id: room.id,
        name: room.name,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
      });
    }
  });
  res.json(publicRooms);
});

app.post('/delete-account', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Account deletion not configured on this server. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.' });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = auth.slice(7);
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return res.status(500).json({ error: deleteError.message });
  }

  res.json({ success: true });
});

app.get('/token', tokenLimiter, async (req, res) => {
  const { room: roomId, username } = req.query;
  if (typeof roomId !== 'string' || typeof username !== 'string' ||
      !roomId.trim() || !username.trim()) {
    return res.status(400).json({ error: 'Missing room or username' });
  }

  const room = getRoom(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  if (!room.players.some(p => p.name === username)) {
    return res.status(403).json({ error: 'Not a member of this room' });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: username,
  });
  at.addGrant({ roomJoin: true, room: roomId });
  res.json({ token: await at.toJwt() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  socket.on('join_room', ({ roomId, playerName }) => {
    if (typeof roomId !== 'string' || roomId.length > 20) return;
    const safeName = typeof playerName === 'string'
      ? playerName.slice(0, 30).trim() || 'Anonymous'
      : 'Anonymous';

    socket.join(roomId);

    let room = getRoom(roomId);
    if (!room) {
      room = createRoom(roomId);
    }

    let player = room.players.find(p => p.id === socket.id);
    if (!player) {
      player = {
        id: socket.id,
        name: safeName,
        isReady: false,
        isHost: room.players.length === 0,
        score: 0,
        avgScore: 0,
        totalPoints: 0,
        roundsPlayed: 0,
      };
      room.players.push(player);
    }

    io.to(roomId).emit('room_state_update', room);
  });

  socket.on('toggle_ready', ({ roomId }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
        io.to(roomId).emit('room_state_update', room);
      }
    }
  });

  socket.on('start_game', ({ roomId, subject }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (room && room.players.find(p => p.id === socket.id)?.isHost) {
      room.subject = typeof subject === 'string' ? subject : null;
      room.currentExplainerIndex = -1;
      room.totalRounds = room.players.length;
      startNextRound(io, roomId);
    }
  });

  socket.on('stroke:draw', ({ roomId, stroke }) => {
    if (typeof roomId !== 'string') return;
    if (!stroke || typeof stroke !== 'object') return;
    if (typeof stroke.x !== 'number' || stroke.x < 0 || stroke.x > 1) return;
    if (typeof stroke.y !== 'number' || stroke.y < 0 || stroke.y > 1) return;
    socket.to(roomId).emit('stroke:replay', stroke);
  });

  socket.on('stroke:clear', ({ roomId }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (room && room.players[room.currentExplainerIndex]?.id === socket.id) {
      io.to(roomId).emit('canvas_clear');
    }
  });

  socket.on('submit_score', ({ roomId, score }) => {
    if (typeof roomId !== 'string') return;
    const validScore = Number(score);
    if (!Number.isInteger(validScore) || validScore < 1 || validScore > 5) return;

    const room = getRoom(roomId);
    if (room && room.status === 'playing') {
      const explainer = room.players[room.currentExplainerIndex];
      if (explainer && explainer.id === socket.id) return;
      room.roundScores[socket.id] = validScore;
      io.to(roomId).emit('room_state_update', room);
    }
  });

  socket.on('disconnect', () => {
    const allRooms = getAllRooms();
    allRooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        if (room.players.length === 0) {
          deleteRoom(roomId);
        } else {
          if (player.isHost) room.players[0].isHost = true;
          if (room.currentExplainerIndex === playerIndex && room.status === 'playing') {
            room.timer = 0;
          } else if (room.currentExplainerIndex > playerIndex) {
            room.currentExplainerIndex--;
          }
          io.to(roomId).emit('room_state_update', room);
        }
      }
    });
  });
});

// Generic error handler — prevents stack traces leaking to clients
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
