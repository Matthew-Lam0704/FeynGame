import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Settings, Coins, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import SettingsModal from './SettingsModal';

export default function ProfileHUD() {
  const [isOpen, setIsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, profile, logout, isGuest } = useUserStore();
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player';
  const navigate = useNavigate();

  if (!user) {
    return (
      <button 
        className="btn btn-primary" 
        onClick={() => navigate('/auth')}
        style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 100 }}
      >
        Sign In
      </button>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  // Mock avatar if none exists
  const avatarUrl = profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

  return (
    <div style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 100 }}>
      {/* HUD Pill */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '1rem', 
          padding: '0.6rem 1.2rem 0.6rem 0.6rem', background: 'rgba(36, 56, 36, 0.8)', 
          backdropFilter: 'blur(10px)', border: '2px solid rgba(232,245,232,0.2)', 
          borderRadius: '40px', cursor: 'pointer', boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ 
          width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', 
          border: '2px solid var(--accent-yellow)', background: 'var(--bg-light)'
        }}>
          <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-chalk)' }}>{username}</div>
            {isGuest && (
              <div style={{ fontSize: '0.6rem', color: '#1e2e1e', background: 'var(--accent-yellow)', padding: '1px 5px', borderRadius: '6px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                GUEST
              </div>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Coins size={12} /> {profile?.tokens || 0}
          </div>
        </div>
        <ChevronDown size={18} color="var(--text-dim)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}
            />
            
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              style={{ 
                position: 'absolute', top: '120%', right: 0, width: '300px',
                background: 'var(--bg-medium)', border: '2px solid rgba(232,245,232,0.15)',
                borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-lg)',
                backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")',
                backgroundSize: '200px'
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ 
                  width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto 1rem',
                  border: '3px solid var(--accent-yellow)', overflow: 'hidden', background: 'var(--bg-light)',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
                }}>
                  <img src={avatarUrl} alt="Large Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <h3 style={{ fontSize: '1.4rem', color: 'var(--text-chalk)' }}>{username}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  {isGuest ? 'Playing as guest — no account' : user?.email}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ 
                  display: 'flex', justifyContent: 'space-between', padding: '1rem', 
                  background: 'rgba(255,255,255,0.03)', borderRadius: '12px', marginBottom: '1rem'
                }}>
                  <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Coins size={18} color="var(--accent-yellow)" /> Balance
                  </span>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{profile?.tokens || 0} 🪙</span>
                </div>

                <MenuButton icon={<Settings size={18} />} label="Settings" onClick={() => { setIsOpen(false); setSettingsOpen(true); }} disabled={isGuest} sublabel={isGuest ? 'Sign in to access' : undefined} />
                <MenuButton icon={<LogOut size={18} />} label="Log out" onClick={handleLogout} color="var(--accent-red)" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function MenuButton({ icon, label, sublabel, onClick, color = 'var(--text-chalk)', disabled = false }) {
  return (
    <motion.button
      whileHover={!disabled ? { x: 5, background: 'rgba(255,255,255,0.05)' } : {}}
      onClick={onClick}
      disabled={disabled}
      style={{ 
        width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', 
        padding: '0.8rem 1rem', borderRadius: '12px', textAlign: 'left',
        opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      <span style={{ color }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.95rem', color }}>{label}</div>
        {sublabel && <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{sublabel}</div>}
      </div>
    </motion.button>
  );
}
