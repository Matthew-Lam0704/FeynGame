import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const derivePlayerName = (user) =>
  user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player';

const loadTokens = (userId) =>
  parseInt(localStorage.getItem(`coins_${userId}`) || '0', 10);

const saveTokens = (userId, amount) =>
  localStorage.setItem(`coins_${userId}`, String(amount));

export const useUserStore = create((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,

  setProfile: (profile) => set({ profile }),

  awardCoins: (amount) => {
    const { user, profile } = get();
    if (!user?.id || amount <= 0) return;
    const current = profile?.tokens || 0;
    const newTotal = current + amount;
    saveTokens(user.id, newTotal);
    set({ profile: { ...profile, tokens: newTotal } });
  },

  initAuth: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      if (user) {
        localStorage.setItem('playerName', derivePlayerName(user));
        set({ user, profile: { tokens: loadTokens(user.id) }, isLoading: false });
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (user) {
        localStorage.setItem('playerName', derivePlayerName(user));
        set({ user, profile: { tokens: loadTokens(user.id) }, isLoading: false });
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    });

    return () => subscription.unsubscribe();
  },

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('playerName');
    set({ user: null, profile: null });
  },
}));
