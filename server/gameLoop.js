const { createClient } = require('@supabase/supabase-js');
const { getRandomWord } = require('./topics');
const { getRoom } = require('./rooms');

const COINS_PER_POINT = 5;

// Lazily-initialised admin client. Mirrors server/index.js — if the env vars
// aren't set, we skip awards entirely (e.g. local dev without Supabase).
let supabaseAdmin = null;
const getAdmin = () => {
  if (supabaseAdmin) return supabaseAdmin;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseAdmin;
};

// Awards coins to every authenticated player in the room. Idempotent at the
// room level via room.coinsAwarded — startNextRound only transitions to
// 'results' once, but this guards against any future re-entry.
const awardCoinsForRoom = async (room) => {
  if (room.coinsAwarded) return;
  room.coinsAwarded = true;

  const admin = getAdmin();
  if (!admin) return;

  await Promise.all(room.players.map(async (player) => {
    if (!player.userId) return;
    const amount = Math.round((player.totalPoints || 0) * COINS_PER_POINT);
    if (amount <= 0) return;
    const { error } = await admin.rpc('award_coins', {
      p_user: player.userId,
      p_amount: amount,
    });
    if (error) {
      console.error(`[AWARD] Failed for user ${player.userId}:`, error.message);
    } else {
      console.log(`[AWARD] +${amount} coins to user ${player.userId} in room ${room.id}`);
    }
  }));
};

const startNextRound = (io, roomId) => {
  const room = getRoom(roomId);
  if (!room) return;

  room.currentExplainerIndex++;
  const explainerIndex = room.currentExplainerIndex % room.players.length;
  const explainer = room.players[explainerIndex];

  console.log(`[ROUND START] Room: ${roomId}, Round: ${room.currentExplainerIndex + 1}/${room.totalRounds}, Explainer: ${explainer?.name}, Duration: ${room.roundDuration}`);

  if (room.currentExplainerIndex >= (room.totalRounds || room.players.length)) {
    room.status = 'results';
    awardCoinsForRoom(room).catch(err => console.error('[AWARD] unexpected error:', err));
    io.to(roomId).emit('room_state_update', room);
    return;
  }

  room.status = 'playing';
  room.timer = room.roundDuration || 90;
  room.topic = getRandomWord(room.subject, room.subtopic);
  room.roundScores = {}; // Reset scores for new round
  room.textBoxes = []; // Clear textboxes for new round
  
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
  if (!room || room.status !== 'playing') return;

  room.status = 'between_rounds';
  if (room.endTurnTimeout) {
    clearTimeout(room.endTurnTimeout);
    room.endTurnTimeout = null;
  }
  
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
