const rooms = new Map();

const createRoom = (roomId) => {
  const room = {
    id: roomId,
    players: [],
    status: 'lobby',
    currentRound: 0,
    totalRounds: 0,
    currentExplainerIndex: -1,
    timer: 90,
    topic: null,
    subject: null,
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
