import { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';

const rawServerUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const SERVER_URL = rawServerUrl.startsWith('http') ? rawServerUrl : `https://${rawServerUrl}`;
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

// Aggressively shut down every microphone-related resource we may have opened.
// The browser will continue to show a mic-in-use indicator until *all* tracks
// associated with the granted permission are stopped — including the initial
// permission probe stream and any LiveKit publication's underlying media track.
const releaseAllAudio = (room, initialStream) => {
  try {
    if (initialStream) {
      initialStream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
    }
  } catch (_) {}

  try {
    if (room) {
      // Walk every publication and stop the underlying MediaStreamTrack — this
      // is what releases the OS-level mic handle. `track.stop()` on the LiveKit
      // wrapper sometimes misses the inner media track on disconnect.
      room.localParticipant?.trackPublications?.forEach((pub) => {
        try { pub.track?.mediaStreamTrack?.stop(); } catch (_) {}
        try { pub.track?.stop(); } catch (_) {}
      });
      try { room.localParticipant?.unpublishAllTracks?.(); } catch (_) {}
      try { room.disconnect(true); } catch (_) {}
    }
  } catch (_) {}

  // Detach any remote audio elements we appended to the body.
  document.querySelectorAll('audio[data-livekit]').forEach((el) => {
    try { el.srcObject = null; } catch (_) {}
    el.remove();
  });
};

export const useAudio = (roomId, playerName, isExplainer, micActive) => {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const localTrackRef = useRef(null);
  const initialStreamRef = useRef(null);
  const roomRef = useRef(null);

  useEffect(() => {
    if (!roomId || !playerName) return;
    let cancelled = false;

    const connect = async () => {
      try {
        const resp = await fetch(
          `${SERVER_URL}/token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(playerName)}`
        );
        if (!resp.ok) {
          const { error: msg } = await resp.json().catch(() => ({}));
          throw new Error(msg || `Token request failed (${resp.status})`);
        }
        const { token } = await resp.json();

        if (cancelled) return;

        const newRoom = new Room();
        await newRoom.connect(LIVEKIT_URL, token);

        if (cancelled) {
          releaseAllAudio(newRoom, initialStreamRef.current);
          return;
        }

        roomRef.current = newRoom;
        setRoom(newRoom);

        const updateParticipants = () =>
          setParticipants(Array.from(newRoom.participants.values()));

        newRoom.on(RoomEvent.ParticipantConnected, updateParticipants);
        newRoom.on(RoomEvent.ParticipantDisconnected, updateParticipants);

        newRoom.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === 'audio') {
            const audioEl = track.attach();
            audioEl.setAttribute('data-livekit', 'true');
            // Apply the user's master volume preference if set
            const v = parseInt(localStorage.getItem('masterVolume') || '80', 10);
            audioEl.volume = Math.min(Math.max(v / 100, 0), 1);
            document.body.appendChild(audioEl);
          }
        });

        newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });

        // Probe permissions early so the dialog isn't disruptive mid-game.
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            if (cancelled) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            initialStreamRef.current = stream;
            // Stop tracks immediately — LiveKit will request its own when we
            // actually need to publish. Keeping a reference lets us verify in
            // dev that nothing leaks.
            stream.getTracks().forEach((t) => t.stop());
          })
          .catch(() => {});

        updateParticipants();
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };

    connect();

    return () => {
      cancelled = true;
      const r = roomRef.current;
      const local = localTrackRef.current;
      const initial = initialStreamRef.current;

      if (local) {
        try { r?.localParticipant?.unpublishTrack(local); } catch (_) {}
        try { local.mediaStreamTrack?.stop(); } catch (_) {}
        try { local.stop(); } catch (_) {}
        localTrackRef.current = null;
      }

      releaseAllAudio(r, initial);
      roomRef.current = null;
      initialStreamRef.current = null;
      setRoom(null);
      setParticipants([]);
    };
  }, [roomId, playerName]);

  // Publish/unpublish the explainer mic.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    const handle = async () => {
      try {
        if (isExplainer && micActive) {
          if (!localTrackRef.current) {
            const deviceId = localStorage.getItem('audioInputDeviceId') || undefined;
            const track = await createLocalAudioTrack(deviceId ? { deviceId } : {});
            if (cancelled) {
              try { track.mediaStreamTrack?.stop(); } catch (_) {}
              try { track.stop(); } catch (_) {}
              return;
            }
            await room.localParticipant.publishTrack(track);
            localTrackRef.current = track;
          } else {
            await localTrackRef.current.unmute();
          }
        } else if (localTrackRef.current) {
          const track = localTrackRef.current;
          localTrackRef.current = null;
          try { await room.localParticipant.unpublishTrack(track); } catch (_) {}
          try { track.mediaStreamTrack?.stop(); } catch (_) {}
          try { track.stop(); } catch (_) {}
        }
      } catch (e) {
        // Surface mic errors but don't crash the room.
        console.error('[useAudio] mic toggle failed:', e);
      }
    };

    handle();
    return () => { cancelled = true; };
  }, [room, isExplainer, micActive]);

  return { room, participants, error };
};
