import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Trash2, Mic, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { supabase } from '../lib/supabase';

const rawServerUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
// Guard against missing protocol (e.g. Vercel dashboard env var without https://)
const SERVER_URL = rawServerUrl.startsWith('http') ? rawServerUrl : `https://${rawServerUrl}`;
const NAV = [
  { id: 'audio', Icon: Volume2, label: 'Audio' },
];

export default function SettingsModal({ isOpen, onClose }) {
  const [section, setSection] = useState('audio');
  const [deleteStep, setDeleteStep] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedInput, setSelectedInput] = useState(() => localStorage.getItem('audioInputDeviceId') || '');
  const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('audioOutputDeviceId') || '');
  const [volume, setVolume] = useState(() => parseInt(localStorage.getItem('masterVolume') || '80', 10));
  const [audioPermissionDenied, setAudioPermissionDenied] = useState(false);

  const { user, profile, logout } = useUserStore();
  const navigate = useNavigate();

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player';
  const avatarUrl = profile?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

  // Load audio devices when audio section opens
  useEffect(() => {
    if (section !== 'audio' || !isOpen) return;
    setAudioPermissionDenied(false);

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach(track => track.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(devices => {
        setInputDevices(devices.filter(d => d.kind === 'audioinput'));
        setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
      })
      .catch(() => setAudioPermissionDenied(true));
  }, [section, isOpen]);

  const handleInputChange = (deviceId) => {
    setSelectedInput(deviceId);
    localStorage.setItem('audioInputDeviceId', deviceId);
  };

  const handleOutputChange = (deviceId) => {
    setSelectedOutput(deviceId);
    localStorage.setItem('audioOutputDeviceId', deviceId);
  };

  const handleVolumeChange = (val) => {
    setVolume(val);
    localStorage.setItem('masterVolume', String(val));
    document.querySelectorAll('audio, video').forEach(el => { el.volume = val / 100; });
  };

  // Reset delete step when switching sections
  useEffect(() => { setDeleteStep(0); setDeleteError(''); }, [section]);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SERVER_URL}/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete account');
      }
      await logout();
      navigate('/auth');
    } catch (err) {
      setDeleteError(err.message);
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '900px', maxWidth: '95vw',
              height: '620px', maxHeight: '90vh',
              background: 'var(--bg-medium)',
              border: '2px solid rgba(232,245,232,0.12)',
              borderRadius: '24px', overflow: 'hidden',
              display: 'flex', boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* ── Left Sidebar ── */}
            <div style={{
              width: '230px', minWidth: '230px',
              background: 'rgba(16,26,16,0.98)',
              borderRight: '1px solid rgba(232,245,232,0.08)',
              display: 'flex', flexDirection: 'column',
              padding: '2rem 1.25rem',
            }}>
              {/* Avatar + user */}
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  margin: '0 auto 0.75rem',
                  border: '2px solid var(--accent-yellow)',
                  overflow: 'hidden', background: 'var(--bg-light)',
                }}>
                  <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-chalk)', fontSize: '0.95rem' }}>{username}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>{user?.email}</div>
              </div>

              {/* Nav items */}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                {NAV.map(({ id, Icon, label }) => (
                  <SidebarItem key={id} Icon={Icon} label={label} active={section === id} onClick={() => setSection(id)} />
                ))}

                {/* Manage Account pinned at bottom */}
                <div style={{ flex: 1 }} />
                <SidebarItem Icon={Trash2} label="Manage Account" active={section === 'manage'} onClick={() => setSection('manage')} danger />
              </nav>
            </div>

            {/* ── Right Content Panel ── */}
            <div style={{ flex: 1, overflow: 'hidden auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  position: 'absolute', top: '1.25rem', right: '1.25rem',
                  color: 'var(--text-dim)', zIndex: 10, padding: '0.3rem',
                }}
              >
                <X size={20} />
              </button>

              <AnimatePresence mode="wait">
                <motion.div
                  key={section}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.15 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '2.5rem', height: '100%' }}
                >
                  {section === 'audio' && (
                    <AudioSection
                      inputDevices={inputDevices}
                      outputDevices={outputDevices}
                      selectedInput={selectedInput}
                      selectedOutput={selectedOutput}
                      volume={volume}
                      permissionDenied={audioPermissionDenied}
                      onInputChange={handleInputChange}
                      onOutputChange={handleOutputChange}
                      onVolumeChange={handleVolumeChange}
                    />
                  )}
                  {section === 'manage' && (
                    <ManageSection
                      username={username}
                      email={user?.email}
                      deleteStep={deleteStep}
                      setDeleteStep={setDeleteStep}
                      isDeleting={isDeleting}
                      deleteError={deleteError}
                      onDelete={handleDeleteAccount}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Sidebar Nav Item ── */
function SidebarItem({ Icon, label, active, onClick, danger = false }) {
  const activeColor = danger ? 'rgba(224,85,85,0.2)' : 'rgba(255,255,255,0.08)';
  const hoverColor = danger ? 'rgba(224,85,85,0.12)' : 'rgba(255,255,255,0.05)';
  const textColor = danger ? 'var(--accent-red)' : (active ? 'var(--text-chalk)' : 'var(--text-dim)');

  return (
    <motion.button
      whileHover={{ x: 3, background: active ? activeColor : hoverColor }}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.7rem 0.9rem', borderRadius: '10px', textAlign: 'left',
        background: active ? activeColor : 'transparent',
        color: textColor,
      }}
    >
      <Icon size={17} />
      <span style={{ fontSize: '0.88rem', fontWeight: active ? 600 : 400 }}>{label}</span>
      {active && !danger && (
        <div style={{ width: '3px', height: '14px', background: 'var(--accent-yellow)', borderRadius: '2px', marginLeft: 'auto' }} />
      )}
    </motion.button>
  );
}

/* ── Audio Section ── */
function AudioSection({ inputDevices, outputDevices, selectedInput, selectedOutput, volume, permissionDenied, onInputChange, onOutputChange, onVolumeChange }) {
  const outputSupported = typeof HTMLAudioElement !== 'undefined' && 'setSinkId' in HTMLAudioElement.prototype;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '500px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-chalk)', marginBottom: '0.4rem' }}>Audio</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          Configure your microphone and speaker preferences.
        </p>
      </div>

      {permissionDenied ? (
        <div style={{
          padding: '1.5rem', borderRadius: '14px',
          background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.3)',
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        }}>
          <AlertTriangle size={18} color="var(--accent-red)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'var(--accent-red)', fontWeight: 600, marginBottom: '0.25rem' }}>Microphone access denied</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
              Allow microphone access in your browser settings to configure audio devices.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Microphone Input */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
              <Mic size={14} /> Microphone Input
            </label>
            <select
              value={selectedInput}
              onChange={e => onInputChange(e.target.value)}
              style={selectStyle}
            >
              <option value="">System Default</option>
              {inputDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
              ))}
            </select>
          </div>

          {/* Speaker Output */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
              <Volume2 size={14} /> Speaker Output
            </label>
            {!outputSupported ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                Output device selection is not supported in this browser. Try Chrome or Edge.
              </div>
            ) : (
              <select
                value={selectedOutput}
                onChange={e => onOutputChange(e.target.value)}
                style={selectStyle}
              >
                <option value="">System Default</option>
                {outputDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 8)}`}</option>
                ))}
              </select>
            )}
          </div>

          {/* Volume */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.8rem' }}>
              <span>Master Volume</span>
              <span style={{ color: 'var(--accent-yellow)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{volume}%</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={e => onVolumeChange(Number(e.target.value))}
                style={rangeStyle}
              />
              <div style={{
                position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)',
                height: '4px', width: `${volume}%`, background: 'var(--accent-yellow)',
                borderRadius: '2px', pointerEvents: 'none', transition: 'width 0.05s',
              }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Manage Account Section ── */
function ManageSection({ username, email, deleteStep, setDeleteStep, isDeleting, deleteError, onDelete }) {
  if (deleteStep === 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={28} color="var(--accent-red)" />
          <h2 style={{ fontSize: '1.4rem', color: 'var(--accent-red)' }}>This is permanent</h2>
        </div>

        <div style={{
          padding: '1.5rem', borderRadius: '14px',
          background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.25)',
        }}>
          <p style={{ color: 'var(--text-chalk)', marginBottom: '1rem', fontSize: '0.92rem' }}>
            Deleting <strong>@{username}</strong> will permanently erase:
          </p>
          <ul style={{ color: 'var(--text-dim)', fontSize: '0.88rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>All your coins and game balance</li>
            <li>All game history and scores</li>
            <li>Your avatar and profile</li>
            <li>Your account login — you will not be able to recover it</li>
          </ul>
        </div>

        {deleteError && (
          <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem' }}>{deleteError}</p>
        )}

        <button
          onClick={onDelete}
          disabled={isDeleting}
          style={{
            width: '100%', padding: '1rem', borderRadius: '12px',
            background: 'var(--accent-red)', color: '#fff',
            fontSize: '0.92rem', fontWeight: 700,
            opacity: isDeleting ? 0.6 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer',
          }}
        >
          {isDeleting ? 'Deleting...' : 'Yes, I confirm I want to delete this account'}
        </button>

        <button
          onClick={() => setDeleteStep(0)}
          disabled={isDeleting}
          style={{ color: 'var(--text-dim)', fontSize: '0.88rem', textDecoration: 'underline' }}
        >
          ← Cancel, keep my account
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '480px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-chalk)', marginBottom: '0.4rem' }}>Manage Account</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Manage your account settings and preferences.</p>
      </div>

      {/* Account info */}
      <div style={{
        padding: '1.25rem', borderRadius: '14px',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(232,245,232,0.1)',
        display: 'flex', flexDirection: 'column', gap: '0.6rem',
      }}>
        <Row label="Username" value={`@${username}`} />
        <Row label="Email" value={email} />
        <Row label="Auth provider" value="Email" />
      </div>

      {/* Danger zone */}
      <div style={{
        padding: '1.5rem', borderRadius: '14px',
        background: 'rgba(224,85,85,0.06)', border: '1px solid rgba(224,85,85,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
          <AlertTriangle size={16} color="var(--accent-red)" />
          <span style={{ color: 'var(--accent-red)', fontWeight: 700, fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Danger Zone</span>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Permanently deletes your account, coins, and all game history. This cannot be undone.
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDeleteStep(1)}
          style={{
            padding: '0.7rem 1.5rem', borderRadius: '10px',
            border: '1px solid var(--accent-red)', color: 'var(--accent-red)',
            background: 'transparent', fontSize: '0.88rem', fontWeight: 600,
          }}
        >
          Delete Account
        </motion.button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{label}</span>
      <span style={{ color: 'var(--text-chalk)', fontSize: '0.88rem', fontFamily: label === 'Email' ? 'var(--font-mono)' : undefined }}>{value}</span>
    </div>
  );
}

const selectStyle = {
  width: '100%', padding: '0.7rem 1rem',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(232,245,232,0.15)',
  borderRadius: '10px', color: 'var(--text-chalk)',
  fontSize: '0.9rem', outline: 'none', cursor: 'pointer',
  appearance: 'none',
};

const rangeStyle = {
  width: '100%', appearance: 'none',
  height: '4px', borderRadius: '2px',
  background: 'rgba(255,255,255,0.1)',
  outline: 'none', cursor: 'pointer',
};
