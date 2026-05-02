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
  const initialStreamRef = useRef(null);

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
        
        // Handle incoming audio from remote participants
        newRoom.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === 'audio') {
            const audioEl = track.attach();
            audioEl.setAttribute('data-livekit', 'true');
            document.body.appendChild(audioEl);
          }
        });
        
        newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach(el => el.remove());
        });

        // Prompt the browser mic dialog at game load so it doesn't interrupt gameplay
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            initialStreamRef.current = stream;
            stream.getTracks().forEach(t => t.stop());
          })
          .catch(() => {});

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
        
        // Stop initial permission stream if still active
        if (initialStreamRef.current) {
          initialStreamRef.current.getTracks().forEach(t => t.stop());
          initialStreamRef.current = null;
        }

        if (localTrackRef.current) {
          r.localParticipant.unpublishTrack(localTrackRef.current);
          localTrackRef.current.stop();
          localTrackRef.current = null;
        }

        // Force stop all local tracks
        r.localParticipant.trackPublications.forEach(pub => {
          if (pub.track) pub.track.stop();
        });
        r.localParticipant.unpublishAllTracks();

        document.querySelectorAll('audio[data-livekit]').forEach(el => el.remove());
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
          const track = localTrackRef.current;
          await room.localParticipant.unpublishTrack(track);
          track.stop();
          localTrackRef.current = null;
        }
      }
    };

    handleMic();
  }, [room, isExplainer, micActive]);

  return { room, participants, error };
};
