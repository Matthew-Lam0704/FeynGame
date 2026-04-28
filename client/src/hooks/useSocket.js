import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

export const useSocket = (roomId, playerName) => {
  const [roomState, setRoomState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      socket.emit('join_room', { roomId, playerName });
    };

    const onRoomStateUpdate = (state) => setRoomState(state);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('room_state_update', onRoomStateUpdate);
    socket.on('disconnect', onDisconnect);

    // Already connected — emit join immediately so we get current room state
    if (socket.connected) {
      socket.emit('join_room', { roomId, playerName });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('room_state_update', onRoomStateUpdate);
      socket.off('disconnect', onDisconnect);
      // Never disconnect the singleton — it must survive page navigation
    };
  }, [roomId, playerName]);

  const toggleReady = () => socket.emit('toggle_ready', { roomId });
  const startGame = ({ subject } = {}) => socket.emit('start_game', { roomId, subject });

  return {
    socket,
    socketId: socket.id,
    roomState,
    isConnected,
    toggleReady,
    startGame,
  };
};
