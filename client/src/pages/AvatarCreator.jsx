import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, RotateCw } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';

export default function AvatarCreator() {
  const navigate = useNavigate();
  const { user, setProfile } = useUserStore();
  const [isLoaded, setIsLoaded] = useState(false);
  const frameRef = useRef(null);

  const RPM_URL = 'https://readyplayer.me/avatar?frameApi';



  useEffect(() => {
    const handleMessage = (event) => {
      const url = event.data;

      if (typeof url === 'string' && url.includes('.glb')) {
        // Avatar created!
        // Save avatar URL to profile
        setProfile({
          avatarUrl: url,
          tokens: 240,
          unlockedItems: []
        });

        navigate('/');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, setProfile]);

  return (
    <div style={{ 
      minHeight: '100vh', display: 'flex', flexDirection: 'column', 
      background: 'var(--bg-dark)', color: 'var(--text-chalk)'
    }}>
      
      <header style={{ padding: '2rem', textAlign: 'center', borderBottom: '1px solid rgba(232,245,232,0.1)' }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}
        >
          <Sparkles color="var(--accent-yellow)" />
          <h2 style={{ fontSize: '2rem', fontFamily: 'var(--font-serif)' }}>Step 2 of 2: Create Your Avatar</h2>
        </motion.div>
        <p style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>This is how your classmates will see you in the halls.</p>
      </header>

      <main style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        
        {!isLoaded && (
          <div style={{ position: 'absolute', zIndex: 1, textAlign: 'center' }}>
            <RotateCw size={48} className="spinner" style={{ color: 'var(--accent-yellow)', marginBottom: '1rem' }} />
            <p style={{ fontFamily: 'var(--font-mono)' }}>COMMUNING WITH THE 3D GODS...</p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.95 }}
          style={{ 
            width: '100%', maxWidth: '1000px', height: '70vh', 
            borderRadius: '24px', overflow: 'hidden', border: '2px solid rgba(232,245,232,0.2)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.4)', background: 'rgba(255,255,255,0.02)'
          }}
        >
          <iframe
            ref={frameRef}
            src={RPM_URL}
            onLoad={() => setIsLoaded(true)}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="camera; microphone; clipboard-write"
          />
        </motion.div>

      </main>

      <footer style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', borderTop: '1px solid rgba(232,245,232,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-dim)' }}>
          <span>Ready to enter the classroom?</span>
          <ArrowRight size={20} />
        </div>
        <button 
          onClick={() => navigate('/')}
          style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textDecoration: 'underline', marginTop: '0.5rem' }}
        >
          Skip customization for now
        </button>
      </footer>


      <style>{`
        .spinner {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
