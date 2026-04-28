import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const derivePlayerName = (user) =>
  user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player';

export const useUserStore = create((set) => ({
  user: null,
  profile: null,
  isLoading: true,

  setProfile: (profile) => set({ profile }),

  initAuth: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      if (user) localStorage.setItem('playerName', derivePlayerName(user));
      set({ user, isLoading: false });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (user) localStorage.setItem('playerName', derivePlayerName(user));
      set({ user, isLoading: false });
    });

    return () => subscription.unsubscribe();
  },

  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('playerName');
    set({ user: null, profile: null });
  },
}));
