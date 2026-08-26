import { create } from 'zustand';
import { User } from '../types';
import { SUPER_ADMIN_EMAIL, isSuperAdmin as checkSuperAdmin, isWardAdmin as checkWardAdmin } from './wardStore';

interface AuthState {
  user: User | null;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setInitialized: (val: boolean) => void;
  logout: () => void;
  hasAccessToWard: (wardId: string) => boolean;
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

export const ADMIN_EMAIL = SUPER_ADMIN_EMAIL;

export const isSuperAdmin = (user: User | null): boolean => {
  return checkSuperAdmin(user);
};

export const isWardAdmin = (user: User | null, wardId?: string): boolean => {
  return checkWardAdmin(user, wardId);
};

export const isSystemAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return checkSuperAdmin(user) || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
};

export const hasWardAccess = (user: User | null, wardId: string): boolean => {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN' || user.wardId === 'all') return true;
  return user.wardId === wardId;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  isInitialized: false,
  setUser: (user) => {
    let resolvedUser = user;
    if (user && (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())) {
      resolvedUser = { 
        ...user, 
        role: 'SUPER_ADMIN', 
        displayName: user.displayName || 'Đ/c Nguyễn Huy (SuperAdmin)',
        wardId: 'all',
        wardName: 'Toàn hệ thống Cấp ủy'
      };
    }
    if (typeof window !== 'undefined') {
      if (resolvedUser) {
        sessionStorage.setItem('trolycvp_user', JSON.stringify(resolvedUser));
        if (!sessionStorage.getItem('gdrive_access_token')) {
          sessionStorage.setItem('gdrive_access_token', 'auto-activated-storage-token');
        }
      } else {
        sessionStorage.removeItem('trolycvp_user');
        sessionStorage.removeItem('gdrive_access_token');
        localStorage.removeItem('trolycvp_user');
      }
    }
    set({ user: resolvedUser });
  },
  setInitialized: (val) => set({ isInitialized: val }),
  logout: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('trolycvp_user');
      sessionStorage.removeItem('gdrive_access_token');
      localStorage.removeItem('trolycvp_user');
    }
    set({ user: null });
  },
  hasAccessToWard: (wardId: string) => {
    const user = get().user;
    return hasWardAccess(user, wardId);
  }
}));
