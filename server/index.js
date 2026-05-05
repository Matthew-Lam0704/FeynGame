const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { AccessToken } = require('livekit-server-sdk');
const { createRoom, getRoom, deleteRoom, getAllRooms, isJoinable, resetBoardState } = require('./rooms');
const { startNextRound, endRound, startExplaining } = require('./gameLoop');
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
const verifyBearer = async (req) => {
  if (!supabaseAdmin) {
    return { status: 503, error: 'Supabase admin client not configured' };
  }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return { status: 401, error: 'Missing authorization header' };
  }
  const token = auth.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { status: 401, error: 'Invalid or expired token' };
  }
  return { user };
};

// Verifies an access token outside the request cycle (used by socket join_room).
const verifyAccessToken = async (token) => {
  if (!supabaseAdmin || typeof token !== 'string') return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
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

// Broadcast updated public-rooms list to anyone subscribed to the home page.
const broadcastPublicRooms = () => {
  const list = collectPublicRooms();
  io.to('home_lobby').emit('public_rooms_update', list);
};

const collectPublicRooms = () => {
  const out = [];
  getAllRooms().forEach((room) => {
    if (room.isPublic && room.status !== 'results') {
      out.push({
        id: room.id,
        name: room.name,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        subject: room.subject,
        subtopic: room.subtopic,
        status: room.status,
        difficulty: room.difficulty,
        joinable: isJoinable(room),
      });
    }
  });
  return out;
};

app.post('/rooms', roomLimiter, (req, res) => {
  const { roomId, name, isPublic, maxPlayers, roundDuration, roundsPerPlayer, subject, subtopic, customWords, difficulty, allowMidJoin } = req.body;
  if (typeof roomId !== 'string' || !/^[A-Z0-9]{1,20}$/.test(roomId)) {
    return res.status(400).json({ error: 'Invalid roomId' });
  }
  const safeName = typeof name === 'string' ? name.slice(0, 50).trim() || roomId : roomId;
  const safePublic = typeof isPublic === 'boolean' ? isPublic : false;
  const safeMax = Number.isInteger(maxPlayers) && maxPlayers >= 2 && maxPlayers <= 8
    ? maxPlayers : 4;
  const safeRoundDuration = Number.isInteger(roundDuration) && roundDuration >= 30 && roundDuration <= 300
    ? roundDuration : 90;
  const safeRoundsPerPlayer = Number.isInteger(roundsPerPlayer) && roundsPerPlayer >= 1 && roundsPerPlayer <= 5
    ? roundsPerPlayer : 1;
  const safeSubject = typeof subject === 'string' ? subject : null;
  const safeSubtopic = typeof subtopic === 'string' ? subtopic : null;
  const safeCustomWords = Array.isArray(customWords)
    ? customWords.filter(w => typeof w === 'string').map(w => w.slice(0, 50)).slice(0, 50)
    : [];
  const safeDifficulty = ['easy', 'normal', 'hard'].includes(difficulty) ? difficulty : 'normal';
  const safeAllowMidJoin = typeof allowMidJoin === 'boolean' ? allowMidJoin : true;

  let room = getRoom(roomId);
  if (!room) {
    createRoom(roomId, {
      name: safeName,
      isPublic: safePublic,
      maxPlayers: safeMax,
      roundDuration: safeRoundDuration,
      roundsPerPlayer: safeRoundsPerPlayer,
      subject: safeSubject,
      subtopic: safeSubtopic,
      customWords: safeCustomWords,
      difficulty: safeDifficulty,
      allowMidJoin: safeAllowMidJoin,
    });
  } else if (room.status === 'lobby') {
    // Overwrite defaults if room was auto-created by socket join
    room.name = safeName;
    room.isPublic = safePublic;
    room.maxPlayers = safeMax;
    room.roundDuration = safeRoundDuration;
    room.roundsPerPlayer = safeRoundsPerPlayer;
    room.subject = safeSubject;
    room.subtopic = safeSubtopic;
    room.customWords = safeCustomWords;
    room.difficulty = safeDifficulty;
    room.allowMidJoin = safeAllowMidJoin;
    room.timer = safeRoundDuration;
    io.to(roomId).emit('room_state_update', room);
  }
  if (safePublic) broadcastPublicRooms();
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
  res.json(collectPublicRooms());
});

app.get('/rooms/:roomId', (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({
    exists: true,
    status: room.status,
    isPublic: room.isPublic,
    joinable: isJoinable(room),
    players: room.players.length,
    maxPlayers: room.maxPlayers,
  });
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

// Update profile metadata (username, displayName). Validates rules server-side
// so a client can't bypass the constraints.
app.post('/api/profile', async (req, res) => {
  const auth = await verifyBearer(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { username, displayName } = req.body || {};
  const updates = {};

  if (typeof username === 'string') {
    const u = username.trim();
    if (u.length < 3 || u.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      return res.status(400).json({ error: 'Letters, numbers, and underscores only' });
    }
    updates.username = u;
  }
  if (typeof displayName === 'string') {
    const d = displayName.trim().slice(0, 40);
    updates.displayName = d;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    auth.user.id,
    { user_metadata: { ...auth.user.user_metadata, ...updates } }
  );
  if (error) {
    console.error('profile update error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true, user_metadata: data?.user?.user_metadata ?? updates });
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
    const msg = error.message || '';
    console.error('purchase_frame rpc error:', { code: error.code, message: msg, details: error.details });

    if (/insufficient coins/i.test(msg)) return res.status(400).json({ error: 'Insufficient tokens' });
    if (/already owned/i.test(msg))      return res.status(400).json({ error: 'Frame already owned' });
    if (/profile not found/i.test(msg))  return res.status(404).json({ error: 'Profile not found' });
    if (/function .* does not exist/i.test(msg)) {
      return res.status(503).json({ error: 'Purchase RPC not deployed. Run server/migrations/002_profile_functions.sql' });
    }

    return res.status(400).json({ error: msg || 'Purchase failed' });
  }

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
  socket.on('register_user', async ({ accessToken }, ack) => {
    if (!supabaseAdmin || typeof accessToken !== 'string') {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }
    const user = await verifyAccessToken(accessToken);
    if (!user) {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }
    socket.data.userId = user.id;
    getAllRooms().forEach((room) => {
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.userId = user.id;
    });
    if (typeof ack === 'function') ack({ ok: true });
  });

  // Subscribe a socket to public-rooms updates while it's on the home page.
  socket.on('home:subscribe', () => {
    socket.join('home_lobby');
    socket.emit('public_rooms_update', collectPublicRooms());
  });
  socket.on('home:unsubscribe', () => {
    socket.leave('home_lobby');
  });

  socket.on('leave_room', ({ roomId }) => {
    if (typeof roomId !== 'string') return;
    handlePlayerLeave(socket, roomId);
  });

  socket.on('join_room', async ({ roomId, playerName, accessToken }) => {
    if (typeof roomId !== 'string' || roomId.length > 20) return;
    let safeName = typeof playerName === 'string'
      ? playerName.slice(0, 30).trim() || 'Anonymous'
      : 'Anonymous';
    safeName = filter.clean(safeName);

    // Verify access token *before* mutating room state — closes the race where
    // join_room arrives before register_user completes.
    if (typeof accessToken === 'string' && !socket.data.userId) {
      const user = await verifyAccessToken(accessToken);
      if (user) socket.data.userId = user.id;
    }

    socket.join(roomId);

    const room = getRoom(roomId);
    if (!room) {
      socket.emit('join_error', { code: 'ROOM_NOT_FOUND' });
      return;
    }

    // Block joins to full or non-joinable in-progress rooms (host can still
    // rejoin via socket.id match below).
    const existingByThisSocket = room.players.find(p => p.id === socket.id);
    if (!existingByThisSocket) {
      if (!isJoinable(room)) {
        socket.emit('join_error', { code: 'ROOM_NOT_JOINABLE' });
        return;
      }
    }

    let player = existingByThisSocket;
    if (!player) {
      // Prevent duplicates on reconnect: remove any stale record matching this
      // identity (preferring userId for authenticated users, name for guests).
      let staleIdx = -1;
      if (socket.data.userId) {
        staleIdx = room.players.findIndex(p => p.userId === socket.data.userId && p.id !== socket.id);
      }
      if (staleIdx === -1) {
        staleIdx = room.players.findIndex(p => p.name === safeName && p.id !== socket.id);
      }
      if (staleIdx !== -1) {
        const wasHost = room.players[staleIdx].isHost;
        room.players.splice(staleIdx, 1);
        // If we just removed the host, mark this incoming player as host
        if (wasHost) {
          // Defer setting isHost until we create the new player below.
          // We'll detect by setting a flag.
          socket.data.assumeHost = true;
        }
      }

      player = {
        id: socket.id,
        userId: socket.data.userId || null,
        name: safeName,
        isReady: false,
        isHost: room.players.length === 0 || socket.data.assumeHost === true,
        score: 0,
        avgScore: 0,
        totalPoints: 0,
        roundsPlayed: 0,
      };
      socket.data.assumeHost = false;
      room.players.push(player);
    }

    if (room.status === 'results') {
      // Re-entering a finished room resets it back to a fresh lobby for everyone.
      room.status = 'lobby';
      room.players.forEach(p => {
        p.score = 0;
        p.avgScore = 0;
        p.totalPoints = 0;
        p.roundsPlayed = 0;
        p.isReady = false;
      });
      room.currentExplainerIndex = -1;
      room.coinsAwarded = false;
      resetBoardState(room);
    }

    io.to(roomId).emit('room_state_update', room);

    // Replay current board state to the joiner so they see strokes / shapes /
    // textboxes that were drawn before they connected. Critical for mid-join.
    if (room.status === 'playing' || room.status === 'between_rounds') {
      socket.emit('board:replay', {
        strokes: room.strokes || [],
        shapes: room.shapes || [],
        textBoxes: room.textBoxes || [],
        topic: room.topic,
      });
    }

    if (room.isPublic) broadcastPublicRooms();
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
    if (!room) return;
    if (!room.players.find(p => p.id === socket.id)?.isHost) return;
    if (room.status !== 'lobby') return;
    if (room.players.length < 2) return;
    if (!room.players.every(p => p.isReady)) return;

    room.currentExplainerIndex = -1;
    room.totalRounds = room.players.length * (room.roundsPerPlayer || 1);
    resetBoardState(room);
    startNextRound(io, roomId);
    if (room.isPublic) broadcastPublicRooms();
  });

  socket.on('update_room_visibility', ({ roomId, isPublic }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room || room.status !== 'lobby') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player?.isHost) return;
    room.isPublic = !!isPublic;
    io.to(roomId).emit('room_state_update', room);
    broadcastPublicRooms();
  });

  socket.on('update_room_settings', ({ roomId, roundDuration, roundsPerPlayer, subject, subtopic, customWords, difficulty, allowMidJoin }) => {
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
    if (typeof difficulty === 'string' && ['easy', 'normal', 'hard'].includes(difficulty))
      room.difficulty = difficulty;
    if (typeof allowMidJoin === 'boolean') room.allowMidJoin = allowMidJoin;
    if (Array.isArray(customWords)) {
      room.customWords = customWords
        .filter(w => typeof w === 'string')
        .map(w => w.slice(0, 50).trim())
        .filter(Boolean)
        .slice(0, 50);
    }

    room.timer = room.roundDuration;
    io.to(roomId).emit('room_state_update', room);
    if (room.isPublic) broadcastPublicRooms();
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

  // Stroke broadcasting + persistence so mid-join replays work.
  socket.on('stroke:draw', ({ roomId, stroke }) => {
    if (typeof roomId !== 'string') return;
    if (!stroke || typeof stroke !== 'object') return;
    if (!['start', 'draw', 'stop'].includes(stroke.type)) return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.status !== 'playing') return;
    const explainer = room.players[room.currentExplainerIndex % room.players.length];
    if (!explainer || explainer.id !== socket.id) return;

    if (stroke.type !== 'stop') {
      if (typeof stroke.x !== 'number' || stroke.x < 0 || stroke.x > 1) return;
      if (typeof stroke.y !== 'number' || stroke.y < 0 || stroke.y > 1) return;
    }

    // Persist into the running stroke list so late joiners can replay.
    if (stroke.type === 'start') {
      room.strokes.push({
        id: Math.random().toString(36).slice(2, 10),
        color: stroke.color,
        size: stroke.size,
        tool: stroke.tool,
        points: [{ x: stroke.x, y: stroke.y }],
      });
    } else if (stroke.type === 'draw') {
      const last = room.strokes[room.strokes.length - 1];
      if (last) last.points.push({ x: stroke.x, y: stroke.y });
    }

    socket.to(roomId).emit('stroke:replay', stroke);
  });

  socket.on('stroke:clear', ({ roomId }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room) return;
    const explainer = room.players[room.currentExplainerIndex % room.players.length];
    if (!explainer || explainer.id !== socket.id) return;
    room.strokes = [];
    room.shapes = [];
    room.textBoxes = [];
    io.to(roomId).emit('canvas_clear');
  });

  socket.on('topic:select', ({ roomId, topic }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room || room.status !== 'selecting_topic') return;

    const explainerIndex = room.currentExplainerIndex % room.players.length;
    if (room.players[explainerIndex]?.id !== socket.id) return;

    room.topic = topic;
    startExplaining(io, roomId);
  });

  socket.on('shape:draw', ({ roomId, type, x1, y1, x2, y2, color, size }) => {
    if (typeof roomId !== 'string') return;
    if (!['line', 'rect', 'circle', 'arrow'].includes(type)) return;
    const room = getRoom(roomId);
    if (!room || room.status !== 'playing') return;
    const explainer = room.players[room.currentExplainerIndex % room.players.length];
    if (!explainer || explainer.id !== socket.id) return;
    if ([x1, y1, x2, y2].some(v => typeof v !== 'number' || v < -0.5 || v > 1.5)) return;

    const shape = { type, x1, y1, x2, y2, color, size };
    room.shapes.push(shape);
    socket.to(roomId).emit('shape:replay', shape);
  });

  socket.on('textbox:add', ({ roomId, id, x, y, text }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.status !== 'playing') return;
    const explainer = room.players[room.currentExplainerIndex % room.players.length];
    if (!explainer || explainer.id !== socket.id) return;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,20}$/.test(id)) return;

    const newBox = {
      id,
      x: typeof x === 'number' ? x : 0,
      y: typeof y === 'number' ? y : 0,
      text: typeof text === 'string' ? text.slice(0, 500) : '',
    };
    room.textBoxes = room.textBoxes || [];
    if (!room.textBoxes.find(tb => tb.id === id)) {
      room.textBoxes.push(newBox);
    }

    io.to(roomId).emit('textbox:add', newBox);
  });

  socket.on('textbox:update', ({ roomId, id, text, x, y, width, height }) => {
    if (typeof roomId !== 'string' || typeof id !== 'string') return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.status !== 'playing') return;
    const explainer = room.players[room.currentExplainerIndex % room.players.length];
    if (!explainer || explainer.id !== socket.id) return;

    let updated = null;
    room.textBoxes = (room.textBoxes || []).map(tb => {
      if (tb.id !== id) return tb;
      updated = {
        ...tb,
        text: text !== undefined ? String(text).slice(0, 500) : tb.text,
        x: typeof x === 'number' ? x : tb.x,
        y: typeof y === 'number' ? y : tb.y,
        width: typeof width === 'number' ? Math.min(Math.max(width, 0), 1) : tb.width,
        height: typeof height === 'number' ? Math.min(Math.max(height, 0), 1) : tb.height,
      };
      return updated;
    });

    if (updated) {
      socket.to(roomId).emit('textbox:update', { id, ...updated });
    }
  });

  socket.on('textbox:delete', ({ roomId, id }) => {
    if (typeof roomId !== 'string') return;
    const room = getRoom(roomId);
    if (!room) return;
    if (room.status !== 'playing') return;
    const explainer = room.players[room.currentExplainerIndex % room.players.length];
    if (!explainer || explainer.id !== socket.id) return;

    room.textBoxes = (room.textBoxes || []).filter(tb => tb.id !== id);
    io.to(roomId).emit('textbox:delete', { id });
  });

  socket.on('submit_score', ({ roomId, score, roundId }) => {
    if (typeof roomId !== 'string') return;
    const validScore = Number(score);
    if (!Number.isInteger(validScore) || validScore < 1 || validScore > 5) return;

    const room = getRoom(roomId);
    if (!room || room.status !== 'playing') return;

    // Reject votes from a stale round (after the timer ticked over).
    if (typeof roundId === 'number' && roundId !== room.roundId) return;

    const explainer = room.players[room.currentExplainerIndex % room.players.length];
    if (!explainer || explainer.id === socket.id) return;
    if (Object.prototype.hasOwnProperty.call(room.roundScores, socket.id)) return;

    room.roundScores[socket.id] = validScore;
    io.to(roomId).emit('room_state_update', room);
  });

  socket.on('chat:message', ({ roomId, playerName, text }) => {
    if (typeof text !== 'string' || text.trim().length === 0) return;
    const sanitized = filter.clean(text.trim().slice(0, 200));
    io.to(roomId).emit('chat:message', { playerName, text: sanitized, ts: Date.now() });
  });

  socket.on('disconnect', () => {
    getAllRooms().forEach((room, roomId) => {
      if (room.players.some(p => p.id === socket.id)) {
        handlePlayerLeave(socket, roomId, /* fromDisconnect */ true);
      }
    });
  });
});

// Centralised player-removal flow used for both leave_room and disconnect.
function handlePlayerLeave(socket, roomId, fromDisconnect = false) {
  const room = getRoom(roomId);
  if (!room) return;
  const playerIndex = room.players.findIndex(p => p.id === socket.id);
  if (playerIndex === -1) return;

  const player = room.players[playerIndex];
  room.players.splice(playerIndex, 1);
  if (!fromDisconnect) {
    socket.leave(roomId);
  }

  if (room.players.length === 0) {
    deleteRoom(roomId);
    if (room.isPublic) broadcastPublicRooms();
    return;
  }

  // Transfer host to whoever's left. Never dissolve a room when the host
  // leaves — the remaining players should keep playing.
  if (player.isHost) {
    room.players[0].isHost = true;
  }

  // If the explainer disconnects mid-round, end the round so the next
  // explainer can take over rather than the timer running out silently.
  const explainerIndex = room.currentExplainerIndex % Math.max(room.players.length, 1);
  if (player.isHost === false || explainerIndex === playerIndex) {
    if (room.status === 'playing' && playerIndex === explainerIndex) {
      room.timer = 0;
    }
  }

  io.to(roomId).emit('room_state_update', room);
  if (room.isPublic) broadcastPublicRooms();
}

// Generic error handler — prevents stack traces leaking to clients
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
