import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export const useSocket = (roomId, playerName) => {
  const socketRef = useRef(null);
  const [roomState, setRoomState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      socketRef.current.emit('join_room', { roomId, playerName });
    });

    socketRef.current.on('room_state_update', (state) => {
      setRoomState(state);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [roomId, playerName]);

  const toggleReady = () => {
    if (socketRef.current) {
      socketRef.current.emit('toggle_ready', { roomId });
    }
  };

  const startGame = () => {
    if (socketRef.current) {
      socketRef.current.emit('start_game', { roomId });
    }
  };

    return {
    socket: socketRef.current,
    socketId: socketRef.current?.id,
    roomState,
    isConnected,
    toggleReady,
    startGame
  };
};

