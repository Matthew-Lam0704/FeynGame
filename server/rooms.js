const rooms = new Map();

const createRoom = (roomId, { name = roomId, isPublic = false, maxPlayers = 4, roundDuration = 90, roundsPerPlayer = 1, subject = null } = {}) => {
  const room = {
    id: roomId,
    name,
    isPublic,
    maxPlayers,
    roundDuration,
    roundsPerPlayer,
    subject,
    players: [],
    status: 'lobby',
    currentRound: 0,
    totalRounds: 0,
    currentExplainerIndex: -1,
    timer: roundDuration,
    topic: null,
    roundScores: {}
  };
  rooms.set(roomId, room);
  return room;
};

const getRoom = (roomId) => rooms.get(roomId);

const deleteRoom = (roomId) => rooms.delete(roomId);

const getAllRooms = () => rooms;

module.exports = {
  createRoom,
  getRoom,
  deleteRoom,
  getAllRooms
};
