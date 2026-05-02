const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { AccessToken } = require('livekit-server-sdk');
const { createRoom, getRoom, deleteRoom, getAllRooms } = require('./rooms');
const { startNextRound, endRound } = require('./gameLoop');
const { wordBank } = require('./topics');
const { getFrame } = require('./frames');
const filter = require('leo-profanity');
filter.loadDictionary('en');

const { createClient } = require('@supabase/supabase-js');

// Supabase admin client (used for account deletion, coin awards, and frame purchases)
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// Verifies a Bearer token from the Authorization header and returns the user.
// Returns { user } on success, or { status, error } on failure (so the caller
// can forward straight to res.status(...).json(...)).
const verifyBearer = async (req) => {
  if (!supabaseAdmin) {
    return { status: 503, error: 'Supabase admin client not configured' };
  }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return { status: 401, error: 'Missing authorization header' };
  }
  const token = auth.slice(7);
  // getUser() actually verifies the JWT signature against Supabase's keys —
  // unlike a raw base64 decode, this rejects forged tokens.
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { status: 401, error: 'Invalid or expired token' };
  }
  return { user };
};

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

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

app.post('/rooms', roomLimiter, (req, res) => {
  const { roomId, name, isPublic, maxPlayers, roundDuration, roundsPerPlayer, subject, subtopic } = req.body;
  if (typeof roomId !== 'string' || !/^[A-Z0-9]{1,20}$/.test(roomId)) {
    return res.status(400).json({ error: 'Invalid roomId' });
  }
  const safeName = typeof name === 'string' ? name.slice(0, 50).trim() : roomId;
  const safePublic = typeof isPublic === 'boolean' ? isPublic : false;
  const safeMax = Number.isInteger(maxPlayers) && maxPlayers >= 2 && maxPlayers <= 8
    ? maxPlayers : 4;
  const safeRoundDuration = Number.isInteger(roundDuration) && roundDuration >= 30 && roundDuration <= 300
    ? roundDuration : 90;
  const safeRoundsPerPlayer = Number.isInteger(roundsPerPlayer) && roundsPerPlayer >= 1 && roundsPerPlayer <= 5
    ? roundsPerPlayer : 1;
  const safeSubject = typeof subject === 'string' ? subject : null;
  const safeSubtopic = typeof subtopic === 'string' ? subtopic : null;

  let room = getRoom(roomId);
  if (!room) {
    createRoom(roomId, { name: safeName, isPublic: safePublic, maxPlayers: safeMax, roundDuration: safeRoundDuration, roundsPerPlayer: safeRoundsPerPlayer, subject: safeSubject, subtopic: safeSubtopic });
  } else if (room.status === 'lobby') {
    // Overwrite defaults if room was auto-created by socket join
    room.name = safeName;
    room.isPublic = safePublic;
    room.maxPlayers = safeMax;
    room.roundDuration = safeRoundDuration;
    room.roundsPerPlayer = safeRoundsPerPlayer;
    room.subject = safeSubject;
    room.subtopic = safeSubtopic;
    room.timer = safeRoundDuration;
    console.log(`[ROOM UPDATE] Room: ${roomId}, Duration: ${room.roundDuration}, Subject: ${room.subject}`);
    io.to(roomId).emit('room_state_update', room);
  }
  res.json({ roomId });
});

app.get('/subjects', (_req, res) => {
  const structure = {};
  Object.entries(wordBank).forEach(([subject, subtopics]) => {
    structure[subject] = Object.keys(subtopics);
  });
  res.json(structure);
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
        subject: room.subject,
        subtopic: room.subtopic,
      });
    }
  });
  res.json(publicRooms);
});

app.post('/delete-account', async (req, res) => {
  const auth = await verifyBearer(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(auth.user.id);
  if (deleteError) {
    console.error('delete-account error:', deleteError);
    return res.status(500).json({ error: deleteError.message });
  }

  res.json({ success: true });
});

app.post('/api/purchase-frame', async (req, res) => {
  const auth = await verifyBearer(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { frameId } = req.body || {};
  if (typeof frameId !== 'string') {
    return res.status(400).json({ error: 'Missing frameId' });
  }
  const frame = getFrame(frameId);
  if (!frame) {
    return res.status(400).json({ error: 'Unknown frame' });
  }
  if (frame.price <= 0) {
    return res.status(400).json({ error: 'Frame is not purchasable' });
  }

  const { data, error } = await supabaseAdmin.rpc('purchase_frame', {
    p_user: auth.user.id,
    p_frame_id: frame.id,
    p_price: frame.price,
  });

  if (error) {
    // RPC raises with a human-readable message on insufficient coins / already owned.
    const msg = error.message || '';
    if (/insufficient coins/i.test(msg)) return res.status(400).json({ error: 'Insufficient coins' });
    if (/already owned/i.test(msg))      return res.status(400).json({ error: 'Frame already owned' });
    if (/profile not found/i.test(msg))  return res.status(404).json({ error: 'Profile not found' });
    console.error('purchase_frame rpc error:', error);
    return res.status(500).json({ error: 'Purchase failed' });
  }

  // Postgres `returns table` comes back as an array; we want the single row.
  const row = Array.isArray(data) ? data[0] : data;
  res.json({ coins: row?.coins, ownedFrames: row?.owned_frames ?? [] });
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

io.on('connection', (socket) => {
  // Authenticated clients call this once on connect; the verified Supabase user
  // id is then attached to the player record on join_room so server-side coin
  // awards know who to credit. Guests skip this step entirely.
  socket.on('register_user', async ({ accessToken }, ack) => {
    if (!supabaseAdmin || typeof accessToken !== 'string') {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }
    socket.data.userId = user.id;
    // Patch any existing player records this socket already owns.
    getAllRooms().forEach((room) => {
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.userId = user.id;
    });
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    if (typeof roomId !== 'string' || roomId.length > 20) return;
    let safeName = typeof playerName === 'string'
      ? playerName.slice(0, 30).trim() || 'Anonymous'
      : 'Anonymous';
    safeName = filter.clean(safeName);

    socket.join(roomId);

    let room = getRoom(roomId);
    if (!room) {
      room = createRoom(roomId);
    }

    let player = room.players.find(p => p.id === socket.id);
    if (!player) {
      player = {
        id: socket.id,
        userId: socket.data.userId || null,
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

  socket.on('start_game', ({ roomId }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (room && room.players.find(p => p.id === socket.id)?.isHost) {
      console.log(`[START GAME] Room: ${roomId}, Duration: ${room.roundDuration}, Subject: ${room.subject}`);
      room.currentExplainerIndex = -1;
      room.totalRounds = room.players.length * (room.roundsPerPlayer || 1);
      startNextRound(io, roomId);
    }
  });

  socket.on('update_room_visibility', ({ roomId, isPublic }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room || room.status !== 'lobby') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;
    room.isPublic = !!isPublic;
    io.to(roomId).emit('room_state_update', room);
  });

  socket.on('update_room_settings', ({ roomId, roundDuration, roundsPerPlayer, subject, subtopic }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room || room.status !== 'lobby') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;
    
    if (Number.isInteger(roundDuration) && roundDuration >= 30 && roundDuration <= 300)
      room.roundDuration = roundDuration;
    if (Number.isInteger(roundsPerPlayer) && roundsPerPlayer >= 1 && roundsPerPlayer <= 5)
      room.roundsPerPlayer = roundsPerPlayer;
    if (typeof subject === 'string') room.subject = subject;
    if (typeof subtopic === 'string') room.subtopic = subtopic;
    
    room.timer = room.roundDuration; // Reset timer for the start of the game
    io.to(roomId).emit('room_state_update', room);
  });

  socket.on('end_turn_request', ({ roomId }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (room && room.status === 'playing') {
      const explainer = room.players[room.currentExplainerIndex % room.players.length];
      if (explainer && explainer.id === socket.id) {
        if (room.endTurnTimeout) return;
        io.to(roomId).emit('done_countdown_start', { duration: 5 });
        room.endTurnTimeout = setTimeout(() => {
          endRound(io, roomId);
          room.endTurnTimeout = null;
        }, 5000);
      }
    }
  });

  socket.on('cancel_end_turn', ({ roomId }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (room && room.status === 'playing' && room.endTurnTimeout) {
      const explainer = room.players[room.currentExplainerIndex % room.players.length];
      if (explainer && explainer.id === socket.id) {
        clearTimeout(room.endTurnTimeout);
        room.endTurnTimeout = null;
        io.to(roomId).emit('done_countdown_cancel');
      }
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

  socket.on('textbox:add', ({ roomId, id, x, y, text }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room) return;

    const newBox = { id, x, y, text: text.slice(0, 500) };
    room.textBoxes = room.textBoxes || [];
    room.textBoxes.push(newBox);
    
    io.to(roomId).emit('room_state_update', room);
    io.to(roomId).emit('textbox:add', newBox);
  });

  socket.on('textbox:update', ({ roomId, id, text }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room) return;

    room.textBoxes = (room.textBoxes || []).map(tb => 
      tb.id === id ? { ...tb, text: text.slice(0, 500) } : tb
    );
    
    io.to(roomId).emit('room_state_update', room);
    socket.to(roomId).emit('textbox:update', { id, text: text.slice(0, 500) });
  });

  socket.on('textbox:delete', ({ roomId, id }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room) return;

    room.textBoxes = (room.textBoxes || []).filter(tb => tb.id !== id);
    
    io.to(roomId).emit('room_state_update', room);
    socket.to(roomId).emit('textbox:delete', { id });
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

  socket.on('chat:message', ({ roomId, playerName, text }) => {
    if (typeof text !== 'string' || text.trim().length === 0) return;
    const sanitized = filter.clean(text.trim().slice(0, 200));
    io.to(roomId).emit('chat:message', { playerName, text: sanitized, ts: Date.now() });
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
          const explainerIndex = room.currentExplainerIndex % Math.max(room.players.length, 1);
          if (explainerIndex === playerIndex && room.status === 'playing') {
            room.timer = 0;
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
