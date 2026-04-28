import { useRef } from 'react';

const SOUNDS = {
  CHALK: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  BELL: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  TICK: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
  WHOOSH: 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3'
};

export const useSounds = () => {
  const audioRefs = useRef({});

  const play = (soundName) => {
    if (!SOUNDS[soundName]) return;
    
    if (!audioRefs.current[soundName]) {
      audioRefs.current[soundName] = new Audio(SOUNDS[soundName]);
    }
    
    const audio = audioRefs.current[soundName];
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const stop = (soundName) => {
    if (audioRefs.current[soundName]) {
      audioRefs.current[soundName].pause();
      audioRefs.current[soundName].currentTime = 0;
    }
  };

  return { play, stop };
};
