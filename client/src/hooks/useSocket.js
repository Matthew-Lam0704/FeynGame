import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import { supabase } from '../lib/supabase';

// Send join_room with the current Supabase access token (if any) so the
// server can verify identity *before* mutating room state. Closes the dup-user
// race that exists when register_user hasn't completed before join_room.
const emitJoin = async (roomId, playerName) => {
  let accessToken;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token;
  } catch { /* guests have no session */ }
  socket.emit('join_room', { roomId, playerName, accessToken });
};

export const useSocket = (roomId, playerName, navigate) => {
  const [roomState, setRoomState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    if (!roomId) return;

    const onConnect = () => {
      setIsConnected(true);
      emitJoin(roomId, playerName);
    };

    const onRoomStateUpdate = (state) => setRoomState(state);
    const onDisconnect = () => setIsConnected(false);
    const onRoomDissolved = () => {
      if (navigate) navigate('/', { state: { error: 'The host has ended the session.' } });
    };
    const onJoinError = (err) => {
      if (!navigate) return;
      const messages = {
        ROOM_NOT_FOUND: 'Room not found or session ended.',
        ROOM_NOT_JOINABLE: 'That room is full or no longer accepting joiners.',
      };
      navigate('/', { state: { error: messages[err?.code] || 'Could not join room.' } });
    };

    socket.on('connect', onConnect);
    socket.on('room_state_update', onRoomStateUpdate);
    socket.on('disconnect', onDisconnect);
    socket.on('room_dissolved', onRoomDissolved);
    socket.on('join_error', onJoinError);

    if (socket.connected) {
      emitJoin(roomId, playerName);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('room_state_update', onRoomStateUpdate);
      socket.off('disconnect', onDisconnect);
      socket.off('room_dissolved', onRoomDissolved);
      socket.off('join_error', onJoinError);
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
