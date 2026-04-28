import { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';

export const useAudio = (roomId, playerName, isExplainer, micActive) => {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const localTrackRef = useRef(null);

  useEffect(() => {
    if (!roomId || !playerName) return;

    const connectToRoom = async () => {
      try {
        // 1. Get token from our server
        const resp = await fetch(`http://localhost:3001/token?room=${roomId}&username=${playerName}`);
        const { token } = await resp.json();

        // 2. Connect to Livekit room (Using local dev server URL by default)
        const livekitUrl = 'ws://localhost:7880'; // Change this if using a different Livekit server
        const newRoom = new Room();
        
        await newRoom.connect(livekitUrl, token);
        console.log('Connected to Livekit room:', roomId);
        
        setRoom(newRoom);

        // 3. Handle participants
        const updateParticipants = () => {
          setParticipants(Array.from(newRoom.participants.values()));
        };

        newRoom.on(RoomEvent.ParticipantConnected, updateParticipants);
        newRoom.on(RoomEvent.ParticipantDisconnected, updateParticipants);
        updateParticipants();

        return newRoom;
      } catch (e) {
        console.error('Livekit connection error:', e);
        setError(e.message);
      }
    };

    const roomPromise = connectToRoom();

    return () => {
      roomPromise.then(r => {
        if (r) r.disconnect();
      });
    };
  }, [roomId, playerName]);

  // Handle publishing/unpublishing based on role and mic state
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
