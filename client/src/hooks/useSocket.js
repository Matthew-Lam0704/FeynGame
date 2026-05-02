import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

export const useSocket = (roomId, playerName, navigate) => {
  const [roomState, setRoomState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      socket.emit('join_room', { roomId, playerName });
    };

    const onRoomStateUpdate = (state) => setRoomState(state);
    const onDisconnect = () => setIsConnected(false);
    const onRoomDissolved = () => {
      if (navigate) navigate('/', { state: { error: 'The host has ended the session.' } });
    };

    socket.on('connect', onConnect);
    socket.on('room_state_update', onRoomStateUpdate);
    socket.on('disconnect', onDisconnect);
    socket.on('room_dissolved', onRoomDissolved);

    // Already connected — emit join immediately so we get current room state
    if (socket.connected) {
      socket.emit('join_room', { roomId, playerName });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('room_state_update', onRoomStateUpdate);
      socket.off('disconnect', onDisconnect);
      socket.off('room_dissolved', onRoomDissolved);
      // Never disconnect the singleton — it must survive page navigation
    };
  }, [roomId, playerName, navigate]);

  const toggleReady = () => socket.emit('toggle_ready', { roomId });
  const startGame = () => socket.emit('start_game', { roomId });

  return {
    socket,
    socketId: socket.id,
    roomState,
    isConnected,
    toggleReady,
    startGame,
  };
};
