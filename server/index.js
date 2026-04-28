const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { AccessToken } = require('livekit-server-sdk');
const { createRoom, getRoom, deleteRoom, getAllRooms } = require('./rooms');
const { startNextRound } = require('./gameLoop');

const app = express();
app.use(cors());
app.use(express.json());

// Livekit Credentials (Use env vars in production)
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';

app.post('/rooms', (req, res) => {
  const { roomId, name, isPublic, maxPlayers } = req.body;
  if (!roomId) return res.status(400).json({ error: 'Missing roomId' });
  if (!getRoom(roomId)) {
    createRoom(roomId, { name, isPublic, maxPlayers });
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

app.get('/token', async (req, res) => {
  const { room, username } = req.query;
  if (!room || !username) {
    return res.status(400).json({ error: 'Missing room or username' });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: username,
  });
  
  at.addGrant({ roomJoin: true, room: room });
  res.json({ token: await at.toJwt() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', ({ roomId, playerName }) => {
    socket.join(roomId);
    
    let room = getRoom(roomId);
    if (!room) {
      room = createRoom(roomId);
    }

    // Check if player already exists (reconnection or duplicate tab)
    let player = room.players.find(p => p.id === socket.id);
    if (!player) {
      player = {
        id: socket.id,
        name: playerName || `Player ${room.players.length + 1}`,
        isReady: false,
        isHost: room.players.length === 0,
        score: 0,
        avgScore: 0,
        totalPoints: 0,
        roundsPlayed: 0
      };
      room.players.push(player);
    }

    io.to(roomId).emit('room_state_update', room);
    console.log(`${player.name} joined room ${roomId}`);
  });

  socket.on('toggle_ready', ({ roomId }) => {
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
    const room = getRoom(roomId);
    if (room && room.players.find(p => p.id === socket.id)?.isHost) {
      room.subject = subject;
      room.currentExplainerIndex = -1;
      room.totalRounds = room.players.length;
      startNextRound(io, roomId);
    }
  });

  socket.on('stroke:draw', ({ roomId, stroke }) => {
    socket.to(roomId).emit('stroke:replay', stroke);
  });

  socket.on('stroke:clear', ({ roomId }) => {
    const room = getRoom(roomId);
    if (room && room.players[room.currentExplainerIndex]?.id === socket.id) {
      io.to(roomId).emit('canvas_clear');
    }
  });

  socket.on('submit_score', ({ roomId, score }) => {
    const room = getRoom(roomId);
    if (room && room.status === 'playing') {
      // Don't let explainer score themselves
      const explainer = room.players[room.currentExplainerIndex];
      if (explainer && explainer.id === socket.id) return;

      room.roundScores[socket.id] = score;
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
          if (player.isHost) {
            room.players[0].isHost = true;
          }
          // If the explainer leaves, we might need to skip their round or end it
          if (room.currentExplainerIndex === playerIndex && room.status === 'playing') {
            room.timer = 0; // Trigger round end logic via timer sync or direct call
          } else if (room.currentExplainerIndex > playerIndex) {
            room.currentExplainerIndex--; // Adjust index if someone before the current explainer left
          }
          io.to(roomId).emit('room_state_update', room);
        }
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
