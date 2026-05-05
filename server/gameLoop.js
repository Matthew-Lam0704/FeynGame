const { createClient } = require('@supabase/supabase-js');
const { getRandomWord } = require('./topics');
const { getRoom, resetBoardState } = require('./rooms');

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
// room level via room.coinsAwarded.
const awardCoinsForRoom = async (room) => {
  if (room.coinsAwarded) return;
  room.coinsAwarded = true;

  const admin = getAdmin();
  if (!admin) return;

  const multiplier = room.difficulty === 'hard' ? 2 : (room.difficulty === 'easy' ? 1 : 1.5);

  await Promise.all(room.players.map(async (player) => {
    if (!player.userId) return;
    const baseAmount = Math.round((player.totalPoints || 0) * COINS_PER_POINT);
    const amount = Math.round(baseAmount * multiplier);
    if (amount <= 0) return;
    const { error } = await admin.rpc('award_coins', {
      p_user: player.userId,
      p_amount: amount,
    });
    if (error) {
      console.error(`[AWARD] Failed for user ${player.userId}:`, error.message);
    }
  }));
};

const startNextRound = (io, roomId) => {
  const room = getRoom(roomId);
  if (!room) return;

  room.currentExplainerIndex++;
  const explainerIndex = room.currentExplainerIndex % Math.max(1, room.players.length);
  const explainer = room.players[explainerIndex];

  if (room.currentExplainerIndex >= (room.totalRounds || room.players.length)) {
    room.status = 'results';
    room.players.forEach(p => { p.isReady = false; });
    awardCoinsForRoom(room).catch(err => console.error('[AWARD] unexpected error:', err));
    io.to(roomId).emit('room_state_update', room);
    return;
  }

  room.status = 'selecting_topic';

  if (room.customWords && room.customWords.length > 0) {
    const shuffled = [...room.customWords].sort(() => Math.random() - 0.5);
    const subjectLabel = room.subject || 'Custom';
    const subtopicLabel = room.subtopic || 'Room';
    room.topicChoices = shuffled.slice(0, 3).map(term => ({ subject: subjectLabel, subtopic: subtopicLabel, term }));
  } else {
    room.topicChoices = [
      getRandomWord(room.subject, room.subtopic),
      getRandomWord(room.subject, room.subtopic),
      getRandomWord(room.subject, room.subtopic),
    ];
  }

  room.timer = 10;
  room.roundId = (room.roundId || 0) + 1;
  resetBoardState(room);

  io.to(roomId).emit('room_state_update', room);
  io.to(roomId).emit('canvas_clear');

  const selectionInterval = setInterval(() => {
    const currentRoom = getRoom(roomId);
    if (!currentRoom || currentRoom.status !== 'selecting_topic') {
      clearInterval(selectionInterval);
      return;
    }

    if (currentRoom.timer > 0) {
      currentRoom.timer -= 1;
      io.to(roomId).emit('timer_sync', currentRoom.timer);
    } else {
      clearInterval(selectionInterval);
      currentRoom.topic = currentRoom.topicChoices[0];
      startExplaining(io, roomId);
    }
  }, 1000);
};

const startExplaining = (io, roomId) => {
  const room = getRoom(roomId);
  if (!room) return;

  room.status = 'playing';
  room.timer = room.roundDuration || 90;
  io.to(roomId).emit('room_state_update', room);

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

  // Snapshot scores immediately; clear the dictionary so a late submission
  // can't corrupt the next round's tally.
  const explainerIndex = room.currentExplainerIndex % Math.max(1, room.players.length);
  const explainer = room.players[explainerIndex];
  const scoreSnapshot = Object.values(room.roundScores || {});
  room.roundScores = {};
  if (explainer && scoreSnapshot.length > 0) {
    const avg = scoreSnapshot.reduce((a, b) => a + b, 0) / scoreSnapshot.length;
    explainer.totalPoints = (explainer.totalPoints || 0) + avg;
    explainer.roundsPlayed = (explainer.roundsPlayed || 0) + 1;
    explainer.avgScore = explainer.totalPoints / explainer.roundsPlayed;
  }

  io.to(roomId).emit('room_state_update', room);

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
  endRound,
  startExplaining,
};
