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
