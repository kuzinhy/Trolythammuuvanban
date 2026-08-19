import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setInitialized: (val: boolean) => void;
}

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('trolycvp_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const ADMIN_EMAIL = 'nguyenhuy.thudaumot@gmail.com';

export const isSystemAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() || user.role === 'ADMIN';
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  isInitialized: false,
  setUser: (user) => {
    let resolvedUser = user;
    if (user && (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())) {
      resolvedUser = { ...user, role: 'ADMIN' };
    }
    if (typeof window !== 'undefined') {
      if (resolvedUser) {
        sessionStorage.setItem('trolycvp_user', JSON.stringify(resolvedUser));
      } else {
        sessionStorage.removeItem('trolycvp_user');
      }
    }
    set({ user: resolvedUser });
  },
  setInitialized: (val) => set({ isInitialized: val }),
}));
