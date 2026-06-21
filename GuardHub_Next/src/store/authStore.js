import { create } from "zustand";

const STORAGE_KEY = "guardhub.user";

function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Auth is a single stored user object (the backend issues no JWT). Route
// guarding keys off `user` being non-null.
export const useAuthStore = create((set) => ({
  user: loadUser(),
  isAuthenticated: !!loadUser(),

  setUser: (user) => {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
    set({ user, isAuthenticated: !!user });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null, isAuthenticated: false });
  },
}));
