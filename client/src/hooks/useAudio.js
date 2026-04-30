import { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';

const rawServerUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const SERVER_URL = rawServerUrl.startsWith('http') ? rawServerUrl : `https://${rawServerUrl}`;
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

export const useAudio = (roomId, playerName, isExplainer, micActive) => {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const localTrackRef = useRef(null);

  useEffect(() => {
    if (!roomId || !playerName) return;

    const connectToRoom = async () => {
      try {
        const resp = await fetch(
          `${SERVER_URL}/token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(playerName)}`
        );
        if (!resp.ok) {
          const { error: msg } = await resp.json().catch(() => ({}));
          throw new Error(msg || `Token request failed (${resp.status})`);
        }
        const { token } = await resp.json();

        const newRoom = new Room();
        await newRoom.connect(LIVEKIT_URL, token);

        setRoom(newRoom);

        const updateParticipants = () =>
          setParticipants(Array.from(newRoom.participants.values()));

        newRoom.on(RoomEvent.ParticipantConnected, updateParticipants);
        newRoom.on(RoomEvent.ParticipantDisconnected, updateParticipants);
        updateParticipants();

        return newRoom;
      } catch (e) {
        setError(e.message);
      }
    };

    const roomPromise = connectToRoom();
    return () => {
      roomPromise.then(r => {
        if (!r) return;
        if (localTrackRef.current) {
          localTrackRef.current.stop();
          localTrackRef.current = null;
        }
        r.disconnect();
      });
    };
  }, [roomId, playerName]);

  useEffect(() => {
    if (!room) return;

    const handleMic = async () => {
      if (isExplainer && micActive) {
        if (!localTrackRef.current) {
          const track = await createLocalAudioTrack();
          await room.localParticipant.publishTrack(track);
          localTrackRef.current = track;
        } else {
          await localTrackRef.current.unmute();
        }
      } else {
        if (localTrackRef.current) {
          await localTrackRef.current.mute();
        }
      }
    };

    handleMic();
  }, [room, isExplainer, micActive]);

  return { room, participants, error };
};
