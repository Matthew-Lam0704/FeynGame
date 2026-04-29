const { getRandomWord } = require('./topics');
const { getRoom } = require('./rooms');

const startNextRound = (io, roomId) => {
  const room = getRoom(roomId);
  if (!room) return;

  room.currentExplainerIndex++;

  if (room.currentExplainerIndex >= (room.totalRounds || room.players.length)) {
    room.status = 'results';
    io.to(roomId).emit('room_state_update', room);
    return;
  }

  room.status = 'playing';
  room.timer = room.roundDuration || 90;
  room.topic = getRandomWord(room.subject, room.subtopic);
  room.roundScores = {}; // Reset scores for new round
  
  io.to(roomId).emit('room_state_update', room);
  io.to(roomId).emit('canvas_clear');

  const timerInterval = setInterval(() => {
    const currentRoom = getRoom(roomId);
    if (!currentRoom || currentRoom.status !== 'playing') {
      clearInterval(timerInterval);
      return;
    }

    if (currentRoom.timer > 0) {
      currentRoom.timer -= 1;
      io.to(roomId).emit('timer_sync', currentRoom.timer);
    } else {
      clearInterval(timerInterval);
      endRound(io, roomId);
    }
  }, 1000);
};

const endRound = (io, roomId) => {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = 'between_rounds';
  
  // Calculate final score for the explainer
  const explainerIndex = room.currentExplainerIndex % room.players.length;
  const explainer = room.players[explainerIndex];
  if (explainer) {
    const scores = Object.values(room.roundScores);
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      explainer.totalPoints += avg;
      explainer.roundsPlayed += 1;
      explainer.avgScore = explainer.totalPoints / explainer.roundsPlayed;
    }
  }

  io.to(roomId).emit('room_state_update', room);

  // 5 second transition
  let transitionTimer = 5;
  io.to(roomId).emit('transition_timer_sync', transitionTimer);
  
  const transitionInterval = setInterval(() => {
    transitionTimer--;
    if (transitionTimer <= 0) {
      clearInterval(transitionInterval);
      startNextRound(io, roomId);
    } else {
      io.to(roomId).emit('transition_timer_sync', transitionTimer);
    }
  }, 1000);
};

module.exports = {
  startNextRound,
  endRound
};
