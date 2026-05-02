import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { socket } from '../lib/socket';

const rawServerUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const SERVER_URL = rawServerUrl.startsWith('http') ? rawServerUrl : `https://${rawServerUrl}`;

const derivePlayerName = (user) =>
  user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player';

const defaultAvatarUrl = (user) =>
  user?.user_metadata?.avatarUrl ||
  `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(derivePlayerName(user))}`;

// Ensure the user has an avatarUrl saved in Supabase metadata. The profiles
// row itself is created by the on_auth_user_created trigger.
const bootstrapAvatar = async (user) => {
  if (user.user_metadata?.avatarUrl) return;
  await supabase.auth.updateUser({ data: { avatarUrl: defaultAvatarUrl(user) } });
};

const fetchProfile = async (user) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('coins, selected_frame_id, owned_frames')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch profile:', error);
    return { tokens: 0, selectedFrameId: null, ownedFrames: [] };
  }

  return {
    tokens: data?.coins ?? 0,
    selectedFrameId: data?.selected_frame_id ?? null,
    ownedFrames: data?.owned_frames ?? [],
  };
};

const registerUserOnSocket = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  socket.emit('register_user', { accessToken: session.access_token });
};

export const useUserStore = create((set, get) => ({
  user: null,
  profile: null,
  isGuest: false,
  isLoading: true,

  setProfile: (profile) => set({ profile }),

  // Re-fetch profile from Supabase. Returns the new profile (or null on guest).
  refreshProfile: async () => {
    const { user, isGuest } = get();
    if (!user || isGuest) return null;
    const next = await fetchProfile(user);
    const profile = { ...(get().profile || {}), ...next };
    set({ profile });
    return profile;
  },

  // Authoritative purchase via server. Returns { ok: true } or { ok: false, error }.
  purchaseFrame: async (frameId) => {
    const { user, isGuest } = get();
    if (!user || isGuest) return { ok: false, error: 'Sign in to purchase frames' };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, error: 'Not authenticated' };

    let res;
    try {
      res = await fetch(`${SERVER_URL}/api/purchase-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ frameId }),
      });
    } catch (err) {
      return { ok: false, error: err.message || 'Network error' };
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body.error || 'Purchase failed' };
    }
    set({
      profile: {
        ...get().profile,
        tokens: body.coins ?? get().profile?.tokens ?? 0,
        ownedFrames: body.ownedFrames ?? get().profile?.ownedFrames ?? [],
      },
    });
    return { ok: true };
  },

  // The user's currently equipped frame is a UI preference — RLS lets the
  // authenticated user update this column directly.
  setSelectedFrame: async (frameId) => {
    const { user, isGuest, profile } = get();
    if (!user || isGuest) return { ok: false, error: 'Sign in required' };

    const owns = frameId === 'none' || frameId === null || profile?.ownedFrames?.includes(frameId);
    if (!owns) return { ok: false, error: 'Frame not owned' };

    const previous = profile?.selectedFrameId ?? null;
    set({ profile: { ...profile, selectedFrameId: frameId } });
    const { error } = await supabase
      .from('profiles')
      .update({ selected_frame_id: frameId })
      .eq('user_id', user.id);
    if (error) {
      console.error('setSelectedFrame failed:', error);
      set({ profile: { ...get().profile, selectedFrameId: previous } });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  loginAsGuest: () => {
    const suffix = Math.random().toString(36).slice(2, 7);
    const username = `Guest_${suffix}`;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
    const guestUser = {
      id: `guest_${suffix}`,
      user_metadata: { username },
      email: null,
    };
    localStorage.setItem('playerName', username);
    set({
      user: guestUser,
      profile: { tokens: 0, avatarUrl, selectedFrameId: null, ownedFrames: [] },
      isGuest: true,
      isLoading: false,
    });
  },

  initAuth: () => {
    // Fallback: don't stay in loading state forever
    const timeout = setTimeout(() => {
      if (get().isLoading) {
        console.warn('Auth initialization timed out');
        set({ isLoading: false });
      }
    }, 5000);

    const hydrate = async (user) => {
      bootstrapAvatar(user).catch(err => console.error('Non-fatal avatar bootstrap error:', err));
      localStorage.setItem('playerName', derivePlayerName(user));
      const profileFields = await fetchProfile(user);
      set({
        user,
        profile: { ...profileFields, avatarUrl: defaultAvatarUrl(user) },
        isGuest: false,
        isLoading: false,
      });
      registerUserOnSocket().catch(err => console.error('register_user emit failed:', err));
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);
      const user = session?.user ?? null;
      if (user) {
        console.log('Session retrieved successfully:', user.id);
        await hydrate(user);
      } else {
        console.log('No active session found');
        set({ user: null, profile: null, isLoading: false });
      }
    }).catch((err) => {
      console.error('getSession error:', err);
      set({ user: null, profile: null, isLoading: false });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      console.log('Auth state changed:', _event, user?.id);
      if (user) {
        await hydrate(user);
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    });

    // Re-emit register_user on every socket reconnect so the server can recover
    // userId after a transient drop.
    const onSocketConnect = () => {
      const { user, isGuest } = get();
      if (user && !isGuest) {
        registerUserOnSocket().catch(err => console.error('register_user emit failed:', err));
      }
    };
    socket.on('connect', onSocketConnect);

    return () => {
      subscription.unsubscribe();
      socket.off('connect', onSocketConnect);
    };
  },

  logout: async () => {
    const { isGuest } = get();
    if (!isGuest) await supabase.auth.signOut();
    localStorage.removeItem('playerName');
    set({ user: null, profile: null, isGuest: false });
  },
}));
