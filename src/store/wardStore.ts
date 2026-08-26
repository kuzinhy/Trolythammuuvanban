import { create } from 'zustand';
import { WardUnit, User } from '../types';

export const INITIAL_WARDS: WardUnit[] = [
  {
    id: 'thu-dau-mot',
    code: 'THU_DAU_MOT',
    name: 'Đảng ủy Phường Thủ Dầu Một',
    shortName: 'Phường Thủ Dầu Một',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'Thành phố Thủ Dầu Một',
    provinceName: 'Tỉnh Bình Dương',
    officeAddress: 'Số 01 Đường Cách Mạng Tháng Tám, Phường Thủ Dầu Một, TP. Thủ Dầu Một',
    contactPhone: '0274 3822 123',
    contactEmail: 'vanphong.danguy@thudaumot.gov.vn',
    technicalSupportContact: 'Đ/c Nguyễn Huy - Chuyên viên CNTT & Quản trị Hệ thống (0912.345.678)',
    defaultSignerTitle: 'Bí thư Đảng ủy Phường',
    driveFolderId: '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR',
    driveFolderName: 'Hồ sơ lưu trữ Văn bản Tham mưu - Phường Thủ Dầu Một',
    status: 'ACTIVE',
    adminEmails: ['nguyenhuy.thudaumot@gmail.com', 'admin.thudaumot@phuong.gov.vn'],
    createdAt: '2025-01-01',
    stats: {
      totalDocuments: 142,
      totalTasks: 48,
      totalOfficers: 12
    }
  }
];

interface WardState {
  wards: WardUnit[];
  activeWardId: string;
  setActiveWardId: (id: string) => void;
  getActiveWard: () => WardUnit;
  addWard: (ward: WardUnit) => void;
  updateWard: (id: string, patch: Partial<WardUnit>) => void;
  deleteWard: (id: string) => void;
  setWards: (wards: WardUnit[]) => void;
  addAdminEmailToWard: (wardId: string, email: string) => void;
  removeAdminEmailFromWard: (wardId: string, email: string) => void;
  resetToDefaults: () => void;
}

const getStoredWards = (): WardUnit[] => {
  if (typeof window === 'undefined') return INITIAL_WARDS;
  try {
    const raw = localStorage.getItem('trolycvp_wards');
    if (raw) {
      const parsed: WardUnit[] = JSON.parse(raw);
      // Keep only 'thu-dau-mot' ward or reset to INITIAL_WARDS
      const filtered = parsed.filter(w => w.id === 'thu-dau-mot' || w.code === 'THU_DAU_MOT');
      if (filtered.length > 0) return filtered;
    }
    localStorage.setItem('trolycvp_wards', JSON.stringify(INITIAL_WARDS));
    return INITIAL_WARDS;
  } catch (_) {
    return INITIAL_WARDS;
  }
};

const getStoredActiveWardId = (): string => {
  if (typeof window === 'undefined') return 'thu-dau-mot';
  try {
    const stored = localStorage.getItem('trolycvp_active_ward_id');
    if (stored === 'thu-dau-mot') return 'thu-dau-mot';
    localStorage.setItem('trolycvp_active_ward_id', 'thu-dau-mot');
    return 'thu-dau-mot';
  } catch (_) {
    return 'thu-dau-mot';
  }
};

export const useWardStore = create<WardState>((set, get) => ({
  wards: getStoredWards(),
  activeWardId: getStoredActiveWardId(),

  setActiveWardId: (id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trolycvp_active_ward_id', id);
    }
    set({ activeWardId: id });
  },

  getActiveWard: () => {
    const state = get();
    const found = state.wards.find(w => w.id === state.activeWardId);
    return found || state.wards[0] || INITIAL_WARDS[0];
  },

  addWard: (newWard: WardUnit) => {
    const current = get().wards;
    const exists = current.some(w => w.id === newWard.id || w.code === newWard.code);
    if (exists) return;
    const updated = [newWard, ...current];
    if (typeof window !== 'undefined') {
      localStorage.setItem('trolycvp_wards', JSON.stringify(updated));
    }
    set({ wards: updated });
  },

  updateWard: (id: string, patch: Partial<WardUnit>) => {
    const current = get().wards;
    const updated = current.map(w => w.id === id ? { ...w, ...patch } : w);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trolycvp_wards', JSON.stringify(updated));
    }
    set({ wards: updated });
  },

  deleteWard: (id: string) => {
    const current = get().wards;
    if (current.length <= 1) return; // Keep at least one ward
    const updated = current.filter(w => w.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trolycvp_wards', JSON.stringify(updated));
    }
    let newActiveId = get().activeWardId;
    if (newActiveId === id) {
      newActiveId = updated[0]?.id || 'thu-dau-mot';
      if (typeof window !== 'undefined') {
        localStorage.setItem('trolycvp_active_ward_id', newActiveId);
      }
    }
    set({ wards: updated, activeWardId: newActiveId });
  },

  setWards: (wards: WardUnit[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trolycvp_wards', JSON.stringify(wards));
    }
    set({ wards });
  },

  addAdminEmailToWard: (wardId: string, email: string) => {
    const current = get().wards;
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    const updated = current.map(w => {
      if (w.id !== wardId) return w;
      if (w.adminEmails.map(e => e.toLowerCase()).includes(normalized)) return w;
      return { ...w, adminEmails: [...w.adminEmails, normalized] };
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('trolycvp_wards', JSON.stringify(updated));
    }
    set({ wards: updated });
  },

  removeAdminEmailFromWard: (wardId: string, email: string) => {
    const current = get().wards;
    const normalized = email.trim().toLowerCase();
    const updated = current.map(w => {
      if (w.id !== wardId) return w;
      return { ...w, adminEmails: w.adminEmails.filter(e => e.toLowerCase() !== normalized) };
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('trolycvp_wards', JSON.stringify(updated));
    }
    set({ wards: updated });
  },

  resetToDefaults: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trolycvp_wards', JSON.stringify(INITIAL_WARDS));
      localStorage.setItem('trolycvp_active_ward_id', 'thu-dau-mot');
    }
    set({ wards: INITIAL_WARDS, activeWardId: 'thu-dau-mot' });
  }
}));

// SUPER ADMIN email constant
export const SUPER_ADMIN_EMAIL = 'nguyenhuy.thudaumot@gmail.com';

// Check if user is Global Super Admin (can manage everything & switch any ward)
export const isSuperAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() || user.role === 'SUPER_ADMIN';
};

// Check if user is Admin of a specific ward (or SuperAdmin)
export const isWardAdmin = (user: User | null, wardId?: string): boolean => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  const targetWardId = wardId || user.wardId;
  if (!targetWardId) return false;

  // Check if role is ADMIN and belongs to ward
  if (user.role === 'ADMIN' && (user.wardId === targetWardId || !user.wardId)) {
    return true;
  }

  // Check ward admin list
  const wards = useWardStore.getState().wards;
  const ward = wards.find(w => w.id === targetWardId);
  if (ward && ward.adminEmails.some(e => e.toLowerCase() === user.email.toLowerCase())) {
    return true;
  }

  return false;
};

// Check if user can manage or edit administrative settings for a ward
export const canManageWard = (user: User | null, wardId: string): boolean => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return isWardAdmin(user, wardId);
};
