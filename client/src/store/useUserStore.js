import { create } from 'zustand';

export const useUserStore = create((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  
  logout: () => {
    localStorage.removeItem('playerName');
    set({ user: null, profile: null });
  }
}));
