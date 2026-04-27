const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { getRandomTopic } = require('./topics');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', ({ roomId, playerName }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        players: [],
        status: 'lobby',
        currentRound: 0,
        totalRounds: 0,
        currentExplainerIndex: -1,
        timer: 90,
        topic: null,
        roundScores: {}
      });
    }

    const room = rooms.get(roomId);
    
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
    const room = rooms.get(roomId);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
        io.to(roomId).emit('room_state_update', room);
      }
    }
  });

  const startNextRound = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.currentExplainerIndex++;
    
    if (room.currentExplainerIndex >= room.players.length) {
      // Game Over
      room.status = 'results';
      io.to(roomId).emit('room_state_update', room);
      return;
    }

    room.status = 'playing';
    room.timer = 90;
    room.topic = getRandomTopic(room.subject);
    room.roundScores = {}; // Reset scores for new round
    
    io.to(roomId).emit('room_state_update', room);
    io.to(roomId).emit('canvas_clear');

    const timerInterval = setInterval(() => {
      const currentRoom = rooms.get(roomId);
      if (!currentRoom || currentRoom.status !== 'playing') {
        clearInterval(timerInterval);
        return;
      }

      if (currentRoom.timer > 0) {
        currentRoom.timer -= 1;
        io.to(roomId).emit('timer_sync', currentRoom.timer);
      } else {
        clearInterval(timerInterval);
        endRound(roomId);
      }
    }, 1000);
  };

  const endRound = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.status = 'between_rounds';
    
    // Calculate final score for the explainer
    const explainer = room.players[room.currentExplainerIndex];
    const scores = Object.values(room.roundScores);
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      explainer.totalPoints += avg;
      explainer.roundsPlayed += 1;
      explainer.avgScore = explainer.totalPoints / explainer.roundsPlayed;
    }

    io.to(roomId).emit('room_state_update', room);

    // 5 second transition
    let transitionTimer = 5;
    const transitionInterval = setInterval(() => {
      transitionTimer--;
      if (transitionTimer <= 0) {
        clearInterval(transitionInterval);
        startNextRound(roomId);
      }
    }, 1000);
  };

  socket.on('start_game', ({ roomId, subject }) => {
    const room = rooms.get(roomId);
    if (room && room.players.find(p => p.id === socket.id)?.isHost) {
      room.subject = subject;
      room.currentExplainerIndex = -1;
      room.totalRounds = room.players.length;
      startNextRound(roomId);
    }
  });

  socket.on('stroke:draw', ({ roomId, stroke }) => {
    socket.to(roomId).emit('stroke:replay', stroke);
  });

  socket.on('submit_score', ({ roomId, score }) => {
    const room = rooms.get(roomId);
    if (room && room.status === 'playing') {
      // Don't let explainer score themselves
      const explainer = room.players[room.currentExplainerIndex];
      if (explainer.id === socket.id) return;

      room.roundScores[socket.id] = score;
      
      // Emit live updates if needed, or just sync room state
      io.to(roomId).emit('room_state_update', room);
    }
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          if (player.isHost) {
            room.players[0].isHost = true;
          }
          // If the explainer leaves, we might need to skip their round or end it
          if (room.currentExplainerIndex === playerIndex && room.status === 'playing') {
            room.timer = 0; // Trigger round end
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

