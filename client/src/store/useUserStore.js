import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const derivePlayerName = (user) =>
  user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player';

const loadTokens = (userId) =>
  parseInt(localStorage.getItem(`coins_${userId}`) || '0', 10);

const saveTokens = (userId, amount) =>
  localStorage.setItem(`coins_${userId}`, String(amount));

const bootstrapNewUser = async (user) => {
  if (user.user_metadata?.avatarUrl) return;
  const username = derivePlayerName(user);
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
  await supabase.auth.updateUser({ data: { avatarUrl } });
  const existing = parseInt(localStorage.getItem(`coins_${user.id}`) || '0', 10);
  if (existing === 0) {
    localStorage.setItem(`coins_${user.id}`, '240');
  }
};

export const useUserStore = create((set, get) => ({
  user: null,
  profile: null,
  isGuest: false,
  isLoading: true,

  setProfile: (profile) => set({ profile }),

  awardCoins: (amount) => {
    const { user, profile, isGuest } = get();
    if (!user?.id || amount <= 0) return;
    const current = profile?.tokens || 0;
    const newTotal = current + amount;
    if (!isGuest) {
      saveTokens(user.id, newTotal);
    }
    set({ profile: { ...profile, tokens: newTotal } });
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
    set({ user: guestUser, profile: { tokens: 0, avatarUrl }, isGuest: true, isLoading: false });
  },

  initAuth: () => {
    // Fallback: don't stay in loading state forever
    const timeout = setTimeout(() => {
      if (get().isLoading) {
        console.warn('Auth initialization timed out');
        set({ isLoading: false });
      }
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);
      const user = session?.user ?? null;
      if (user) {
        try { await bootstrapNewUser(user); } catch (_) { /* non-fatal */ }
        localStorage.setItem('playerName', derivePlayerName(user));
        const tokens = loadTokens(user.id);
        const avatarUrl =
          user.user_metadata?.avatarUrl ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(derivePlayerName(user))}`;
        set({ user, profile: { tokens, avatarUrl }, isLoading: false });
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    }).catch(() => {
      set({ user: null, profile: null, isLoading: false });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      if (user) {
        try { await bootstrapNewUser(user); } catch (_) { /* non-fatal */ }
        localStorage.setItem('playerName', derivePlayerName(user));
        const tokens = loadTokens(user.id);
        const avatarUrl =
          user.user_metadata?.avatarUrl ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(derivePlayerName(user))}`;
        set({ user, profile: { tokens, avatarUrl }, isLoading: false });
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    });

    return () => subscription.unsubscribe();
  },

  logout: async () => {
    const { isGuest } = get();
    if (!isGuest) await supabase.auth.signOut();
    localStorage.removeItem('playerName');
    set({ user: null, profile: null, isGuest: false });
  },
}));
