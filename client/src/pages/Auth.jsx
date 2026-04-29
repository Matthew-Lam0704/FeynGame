import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const location = useLocation();
  const initialMode = location.state?.mode;
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const passwordRules = [
    { label: 'Min 8 characters', met: password.length >= 8 },
  ];

  const getPasswordStrength = () => {
    if (password.length >= 8) return { label: 'Strong', color: '#e8f5e8' };
    if (password.length >= 4) return { label: 'Medium', color: '#f5c842' };
    return { label: 'Weak', color: '#e05555' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isLogin) {
      if (username.length < 8 || username.length > 20) {
        setError('Username must be 8-20 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('Only letters, numbers, and underscores allowed.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        navigate('/');
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (authError) throw authError;
        setSuccessMsg('Check your email to confirm your account, then log in.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider });
    if (authError) setError(authError.message);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email address above first.');
      return;
    }
    setError('');
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email);
    if (authError) {
      setError(authError.message);
    } else {
      setSuccessMsg('Password reset email sent!');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-dark)', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-matter.png")',
        opacity: 0.3, pointerEvents: 'none'
      }} />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: '3rem', zIndex: 1 }}
      >
        <h1 style={{ fontSize: '4rem', color: 'var(--text-chalk)', marginBottom: '0.5rem' }}>Feynman Club</h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>explain it simply. win.</p>
      </motion.div>

      <motion.div
        layout
        className="glass-panel"
        style={{
          width: '90%', maxWidth: '450px', padding: '3rem', zIndex: 1,
          border: '2px solid rgba(232, 245, 232, 0.15)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', marginBottom: '2.5rem', position: 'relative' }}>
          <button onClick={() => setIsLogin(true)} style={{ flex: 1, padding: '0.5rem', fontSize: '1.2rem', color: isLogin ? 'var(--text-chalk)' : 'var(--text-dim)' }}>
            Login
          </button>
          <button onClick={() => setIsLogin(false)} style={{ flex: 1, padding: '0.5rem', fontSize: '1.2rem', color: !isLogin ? 'var(--text-chalk)' : 'var(--text-dim)' }}>
            Sign Up
          </button>
          <motion.div
            animate={{ x: isLogin ? '0%' : '100%' }}
            style={{ position: 'absolute', bottom: 0, left: 0, width: '50%', height: '2px', background: 'var(--accent-yellow)', boxShadow: '0 0 10px var(--accent-yellow)' }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={isLogin ? 'login' : 'signup'}
            initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {!isLogin && (
              <div className="input-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="student_42" required style={inputStyle} />
                </div>
              </div>
            )}

            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="scholar@university.edu" required style={inputStyle} />
              </div>
            </div>

            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={inputStyle}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                  {showPassword ? <EyeOff size={18} color="var(--text-dim)" /> : <Eye size={18} color="var(--text-dim)" />}
                </button>
              </div>

              {!isLogin && password.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    <span>Strength</span>
                    <span style={{ color: getPasswordStrength().color }}>{getPasswordStrength().label}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <motion.div
                      animate={{ width: `${(passwordRules.filter(r => r.met).length / 1) * 100}%`, backgroundColor: getPasswordStrength().color }}
                      style={{ height: '100%' }}
                    />
                  </div>
                  <div style={{ marginTop: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {passwordRules.map(rule => (
                      <div key={rule.label} style={{ fontSize: '0.7rem', color: rule.met ? 'var(--text-chalk)' : 'rgba(224, 85, 85, 0.6)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: rule.met ? 'var(--accent-yellow)' : 'currentColor' }} />
                        {rule.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} style={{ color: 'var(--accent-red)', fontSize: '0.85rem', textAlign: 'center' }}>
                {error}
              </motion.p>
            )}
            {successMsg && (
              <motion.p initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} style={{ color: '#e8f5e8', fontSize: '0.85rem', textAlign: 'center' }}>
                {successMsg}
              </motion.p>
            )}

            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1rem', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'Please wait...' : (isLogin ? 'Enter the Classroom' : 'Start My Journey')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1rem 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(232, 245, 232, 0.1)' }} />
              <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>OR CONTINUE WITH</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(232, 245, 232, 0.1)' }} />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn" onClick={() => handleOAuth('google')} style={{ flex: 1, padding: '0.8rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#ea4335" d="M12 5.04c1.94 0 3.51.66 4.87 1.96L20.55 3.3C18.17 1.25 15.17 0 12 0 7.31 0 3.25 2.69 1.24 6.6l4.41 3.42c1.03-3.09 3.92-5.38 6.35-5.38z" />
                  <path fill="#4285f4" d="M23.49 12.27c0-.85-.07-1.47-.22-2.11H12v4.22h6.44c-.28 1.47-1.11 2.72-2.36 3.56l4.42 3.43c2.58-2.38 4.07-5.88 4.07-9.1z" />
                  <path fill="#fbbc05" d="M5.65 14.58c-.26-.77-.41-1.59-.41-2.42s.15-1.65.41-2.42L1.24 6.6C.45 8.17 0 9.97 0 12c0 2.03.45 3.83 1.24 5.4l4.41-3.42z" />
                  <path fill="#34a853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-4.42-3.43c-1.23.83-2.8 1.32-4.53 1.32-4.33 0-7.99-2.92-9.3-6.84L1.24 17.4C3.25 21.31 7.31 24 12 24z" />
                </svg>
              </button>
              <button type="button" className="btn" onClick={() => handleOAuth('apple')} style={{ flex: 1, padding: '0.8rem' }}>
                <svg width="20" height="20" viewBox="0 0 384 512">
                  <path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                </svg>
              </button>
            </div>

            {isLogin && (
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.5rem', textDecoration: 'underline' }}
              >
                Forgot password?
              </button>
            )}
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '0.8rem 1rem 0.8rem 2.5rem',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(232, 245, 232, 0.2)',
  borderRadius: '10px',
  color: 'var(--text-chalk)',
  fontSize: '1rem',
  transition: 'all 0.3s ease',
  outline: 'none',
};
