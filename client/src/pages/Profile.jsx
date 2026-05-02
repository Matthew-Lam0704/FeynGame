import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Award, BarChart2, Star, Settings as SettingsIcon } from 'lucide-react';
import AvatarFrame from '../components/AvatarFrame';
import ProfileHUD from '../components/ProfileHUD';
import { useUserStore } from '../store/useUserStore';

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, logout } = useUserStore();
  const playerName = user?.user_metadata?.username || 'Guest';
  
  const [stats, setStats] = useState({
    gamesPlayed: parseInt(localStorage.getItem(`feyn_stats_${user?.id}_games`) || '0'),
    avgScore: parseFloat(localStorage.getItem(`feyn_stats_${user?.id}_avg`) || '0'),
    wins: parseInt(localStorage.getItem(`feyn_stats_${user?.id}_wins`) || '0'),
    totalPoints: parseFloat(localStorage.getItem(`feyn_stats_${user?.id}_total`) || '0')
  });

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <div className="profile-container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh' }}>
      <ProfileHUD />
      
      <header style={{ width: '100%', maxWidth: '800px', display: 'flex', alignItems: 'center', marginBottom: '3rem' }}>
        <button 
          onClick={() => navigate('/')}
          className="btn"
          style={{ padding: '0.5rem', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ marginLeft: '1.5rem', fontSize: '2rem', fontFamily: 'var(--font-serif)' }}>My Profile</h1>
      </header>

      <main style={{ width: '100%', maxWidth: '800px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Left Col: Identity */}
        <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ position: 'relative', marginBottom: '2rem' }}>
            <AvatarFrame 
              src={profile?.avatarUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${playerName}`} 
              size={120}
              frameId={profile?.selectedFrameId}
            />
          </div>
          
          <div style={{ width: '100%', textAlign: 'left' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Username
            </label>
            <div style={{
                width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.1)', color: 'var(--text-chalk)', fontSize: '1.1rem', fontWeight: 'bold'
              }}>
              {playerName}
            </div>
          </div>

          <div style={{ marginTop: '2rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(245, 200, 66, 0.05)', borderRadius: '12px', border: '1px solid rgba(245, 200, 66, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-yellow)' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Scholar Tokens</span>
              </div>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{profile?.tokens || 0}</span>
            </div>
            
            <button 
              onClick={handleLogout}
              className="btn"
              style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', marginTop: '1rem' }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Right Col: Stats */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={20} color="var(--accent-yellow)" /> Lifetime Stats
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Games</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-chalk)' }}>{stats.gamesPlayed}</div>
            </div>
            <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: 'var(--accent-yellow)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Wins</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{stats.wins}</div>
            </div>
            <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: 'var(--accent-blue)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Avg Score</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{stats.avgScore.toFixed(1)}</div>
            </div>
            <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: 'var(--accent-red)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Pts</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-red)' }}>{stats.totalPoints.toFixed(0)}</div>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} /> Recent Achievements
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {stats.gamesPlayed > 0 && <Badge icon={<Star size={12} />} label="First Lesson" color="#f5c842" />}
              {stats.wins > 0 && <Badge icon={<Award size={12} />} label="Top Scholar" color="#5599e0" />}
              {stats.avgScore > 4 && <Badge icon={<Award size={12} />} label="Master Explainer" color="#e05555" />}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

function Badge({ icon, label, color }) {
  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px',
      background: `${color}15`, border: `1px solid ${color}33`, color: color, fontSize: '0.75rem', fontWeight: 'bold'
    }}>
      {icon} {label}
    </div>
  );
}
