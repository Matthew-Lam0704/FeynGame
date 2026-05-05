import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Award, BarChart2, Star, Pencil, Check, X } from 'lucide-react';
import AvatarFrame from '../components/AvatarFrame';
import ProfileHUD from '../components/ProfileHUD';
import { useUserStore } from '../store/useUserStore';
import { supabase } from '../lib/supabase';

const rawServerUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const SERVER_URL = rawServerUrl.startsWith('http') ? rawServerUrl : `https://${rawServerUrl}`;

const validateUsername = (u) => {
  if (typeof u !== 'string') return 'Username required';
  const trimmed = u.trim();
  if (trimmed.length < 3 || trimmed.length > 20) return 'Username must be 3-20 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Letters, numbers, and underscores only';
  return null;
};

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, logout, isGuest } = useUserStore();
  const initialUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Guest';
  const initialDisplayName = user?.user_metadata?.displayName || initialUsername;

  const [editingUsername, setEditingUsername] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(initialUsername);
  const [displayNameDraft, setDisplayNameDraft] = useState(initialDisplayName);
  const [savingField, setSavingField] = useState(null);
  const [error, setError] = useState('');

  const stats = {
    gamesPlayed: parseInt(localStorage.getItem(`feyn_stats_${user?.id}_games`) || '0'),
    avgScore: parseFloat(localStorage.getItem(`feyn_stats_${user?.id}_avg`) || '0'),
    wins: parseInt(localStorage.getItem(`feyn_stats_${user?.id}_wins`) || '0'),
    totalPoints: parseFloat(localStorage.getItem(`feyn_stats_${user?.id}_total`) || '0'),
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const saveProfile = async (field, value) => {
    setError('');
    if (field === 'username') {
      const validationError = validateUsername(value);
      if (validationError) {
        setError(validationError);
        return false;
      }
    }
    if (isGuest) {
      setError('Sign up to save profile changes.');
      return false;
    }
    setSavingField(field);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const resp = await fetch(`${SERVER_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(field === 'username' ? { username: value } : { displayName: value }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error || 'Save failed');

      // Refresh the local session so user_metadata updates
      await supabase.auth.refreshSession();
      const { data: { user: refreshed } } = await supabase.auth.getUser();
      if (refreshed) {
        useUserStore.setState({ user: refreshed });
      }
      if (field === 'username') {
        localStorage.setItem('playerName', value.trim());
      }
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSavingField(null);
    }
  };

  return (
    <div className="profile-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh' }}>
      <ProfileHUD />

      <header style={{ width: '100%', maxWidth: '800px', display: 'flex', alignItems: 'center', marginBottom: '3rem' }}>
        <motion.button
          whileHover={{ x: -2 }}
          onClick={() => navigate('/')}
          className="btn"
          style={{ padding: '0.5rem', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <ArrowLeft size={24} />
        </motion.button>
        <h1 style={{ marginLeft: '1.5rem', fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-chalk)' }}>My Profile</h1>
      </header>

      <main style={{ width: '100%', maxWidth: '800px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

        <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <AvatarFrame
              src={profile?.avatarUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${initialUsername}`}
              size={120}
              frameId={profile?.selectedFrameId}
            />
          </div>

          <div style={{ width: '100%', textAlign: 'left', marginBottom: 'var(--space-4)' }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)', marginBottom: 'var(--space-2)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Username
            </label>
            <FieldRow
              editing={editingUsername}
              draft={usernameDraft}
              setDraft={setUsernameDraft}
              originalValue={initialUsername}
              onCancel={() => { setUsernameDraft(initialUsername); setEditingUsername(false); setError(''); }}
              onEdit={() => { setEditingUsername(true); setError(''); }}
              onSave={async () => {
                const ok = await saveProfile('username', usernameDraft);
                if (ok) setEditingUsername(false);
              }}
              saving={savingField === 'username'}
              monospace
              disabled={isGuest}
              hint={isGuest ? 'Sign up to change' : undefined}
            />
          </div>

          <div style={{ width: '100%', textAlign: 'left', marginBottom: 'var(--space-4)' }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)', marginBottom: 'var(--space-2)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Display Name
            </label>
            <FieldRow
              editing={editingDisplayName}
              draft={displayNameDraft}
              setDraft={setDisplayNameDraft}
              originalValue={initialDisplayName}
              onCancel={() => { setDisplayNameDraft(initialDisplayName); setEditingDisplayName(false); setError(''); }}
              onEdit={() => { setEditingDisplayName(true); setError(''); }}
              onSave={async () => {
                const ok = await saveProfile('displayName', displayNameDraft);
                if (ok) setEditingDisplayName(false);
              }}
              saving={savingField === 'displayName'}
              disabled={isGuest}
              hint={isGuest ? 'Sign up to change' : undefined}
            />
          </div>

          {error && (
            <div style={{ width: '100%', color: 'var(--accent-red)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: '1rem', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ padding: '1rem', background: 'rgba(245, 200, 66, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 200, 66, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-yellow)' }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>Coins</span>
              </div>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{profile?.tokens || 0}</span>
            </div>

            <button
              onClick={handleLogout}
              className="btn"
              style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', marginTop: 'var(--space-2)' }}
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-chalk)' }}>
            <BarChart2 size={20} color="var(--accent-yellow)" /> Lifetime Stats
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Stat label="Games" value={stats.gamesPlayed} color="var(--text-chalk)" />
            <Stat label="Wins" value={stats.wins} color="var(--accent-yellow)" />
            <Stat label="Avg Score" value={stats.avgScore.toFixed(1)} color="var(--accent-blue)" />
            <Stat label="Total Pts" value={stats.totalPoints.toFixed(0)} color="var(--accent-red)" />
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: 'var(--text-md)', marginBottom: '1rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
              <Award size={18} /> Recent Achievements
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {stats.gamesPlayed > 0 && <Badge icon={<Star size={12} />} label="First Lesson" color="#f5c842" />}
              {stats.wins > 0 && <Badge icon={<Award size={12} />} label="Top Scholar" color="#5599e0" />}
              {stats.avgScore > 4 && <Badge icon={<Award size={12} />} label="Master Explainer" color="#e05555" />}
              {stats.gamesPlayed === 0 && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                  Play your first session to start unlocking these.
                </span>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

function FieldRow({ editing, draft, setDraft, originalValue, onCancel, onEdit, onSave, saving, monospace, disabled, hint }) {
  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            flex: 1, padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(245, 200, 66, 0.4)', background: 'rgba(0,0,0,0.2)',
            color: 'var(--text-chalk)', fontSize: 'var(--text-md)', fontFamily: monospace ? 'var(--font-mono)' : 'inherit',
          }}
        />
        <button
          onClick={onSave}
          disabled={saving || draft.trim() === originalValue.trim()}
          style={iconButtonStyle('var(--accent-green)', saving || draft.trim() === originalValue.trim())}
          title="Save"
        >
          <Check size={18} />
        </button>
        <button onClick={onCancel} disabled={saving} style={iconButtonStyle('var(--text-dim)', false)} title="Cancel">
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <div style={{
        flex: 1, padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.1)',
        color: 'var(--text-chalk)', fontSize: 'var(--text-md)', fontWeight: 'bold',
        fontFamily: monospace ? 'var(--font-mono)' : 'inherit',
      }}>
        {originalValue}
      </div>
      <button
        onClick={onEdit}
        disabled={disabled}
        style={iconButtonStyle('var(--text-dim)', disabled)}
        title={hint || 'Edit'}
      >
        <Pencil size={16} />
      </button>
    </div>
  );
}

function iconButtonStyle(color, disabled) {
  return {
    width: 38, height: 38, borderRadius: 'var(--radius-md)',
    border: `1px solid ${color === 'var(--accent-green)' ? 'rgba(76, 219, 138, 0.5)' : 'rgba(255,255,255,0.1)'}`,
    background: 'rgba(255,255,255,0.04)',
    color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  };
}

function Stat({ label, value, color }) {
  return (
    <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ color: 'var(--text-dim)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', color, fontFamily: 'var(--font-chalk)' }}>{value}</div>
    </div>
  );
}

function Badge({ icon, label, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: 'var(--radius-pill)',
      background: `${color}15`, border: `1px solid ${color}33`, color, fontSize: 'var(--text-xs)', fontWeight: 'bold',
    }}>
      {icon} {label}
    </div>
  );
}
