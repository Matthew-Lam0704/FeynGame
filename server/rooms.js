const rooms = new Map();

const createRoom = (roomId, {
  name = roomId,
  isPublic = false,
  maxPlayers = 4,
  roundDuration = 90,
  roundsPerPlayer = 1,
  subject = null,
  subtopic = null,
  customWords = [],
  difficulty = 'normal',
  allowMidJoin = true,
} = {}) => {
  const room = {
    id: roomId,
    name,
    isPublic,
    maxPlayers,
    roundDuration,
    roundsPerPlayer,
    subject,
    subtopic,
    customWords,
    difficulty,
    allowMidJoin,
    players: [],
    status: 'lobby',
    currentRound: 0,
    totalRounds: 0,
    currentExplainerIndex: -1,
    timer: roundDuration,
    topic: null,
    roundScores: {},
    roundId: 0,
    textBoxes: [],
    strokes: [],
    shapes: [],
  };
  rooms.set(roomId, room);
  return room;
};

const getRoom = (roomId) => rooms.get(roomId);

const deleteRoom = (roomId) => rooms.delete(roomId);

const getAllRooms = () => rooms;

// A room is joinable from outside the lobby only when explicit mid-join is on,
// it isn't terminal (results), and there's seat room. Used for the public list.
const isJoinable = (room) => {
  if (!room) return false;
  if (room.status === 'results') return false;
  if (room.players.length >= room.maxPlayers) return false;
  if (room.status === 'lobby') return true;
  return !!room.allowMidJoin;
};

// Reset round-scoped board state. Called between rounds and on game end.
const resetBoardState = (room) => {
  if (!room) return;
  room.strokes = [];
  room.shapes = [];
  room.textBoxes = [];
  room.roundScores = {};
};

module.exports = {
  createRoom,
  getRoom,
  deleteRoom,
  getAllRooms,
  isJoinable,
  resetBoardState,
};
