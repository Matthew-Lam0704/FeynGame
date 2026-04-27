const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // TODO: configure for production
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Basic room state management
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', ({ roomId, playerName }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        players: [],
        status: 'lobby', // lobby, playing, between_rounds, results
      });
    }

    const room = rooms.get(roomId);
    const newPlayer = {
      id: socket.id,
      name: playerName || `Player ${room.players.length + 1}`,
      isReady: false,
      isHost: room.players.length === 0,
      score: 0
    };

    room.players.push(newPlayer);

    // Notify room of new player list
    io.to(roomId).emit('room_state_update', room);
    console.log(`${newPlayer.name} joined room ${roomId}`);
  });

  socket.on('toggle_ready', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
        io.to(roomId).emit('room_state_update', room);
      }
    }
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.players.find(p => p.id === socket.id)?.isHost) {
      room.status = 'playing';
      room.currentExplainerIndex = 0;
      room.timer = 90;
      io.to(roomId).emit('room_state_update', room);
      
      // Start server-side timer loop for this room
      const timerInterval = setInterval(() => {
        if (room.timer > 0) {
          room.timer -= 1;
          io.to(roomId).emit('timer_sync', room.timer);
        } else {
          clearInterval(timerInterval);
          // Handle round end logic
        }
      }, 1000);
    }
  });

  socket.on('stroke:draw', ({ roomId, stroke }) => {
    // Relay stroke to everyone else in the room
    socket.to(roomId).emit('stroke:replay', stroke);
  });

  socket.on('submit_score', ({ roomId, score }) => {
    const room = rooms.get(roomId);
    if (room && room.status === 'playing') {
      const explainer = room.players[room.currentExplainerIndex];
      // Store individual player's score for this round in a roundScores map
      if (!room.roundScores) room.roundScores = {};
      room.roundScores[socket.id] = score;
      
      // Calculate average and update explainer's total score
      const scores = Object.values(room.roundScores);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      explainer.currentRoundAvg = avg;

      io.to(roomId).emit('room_state_update', room);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Handle player removal from rooms
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        // If room is empty, delete it
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          // If host left, reassign host
          if (!room.players.some(p => p.isHost)) {
            room.players[0].isHost = true;
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
