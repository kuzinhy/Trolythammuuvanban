import { create } from 'zustand';
import { WardUnit, User } from '../types';

export const INITIAL_WARDS: WardUnit[] = [
  {
    id: 'phu-cuong',
    code: 'PHU_CUONG',
    name: 'Đảng ủy Phường Phú Cường',
    shortName: 'Phường Phú Cường',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'Thành phố Thủ Dầu Một',
    provinceName: 'Tỉnh Bình Dương',
    officeAddress: 'Số 01 Đường Cách Mạng Tháng Tám, Phường Phú Cường, TP. Thủ Dầu Một',
    contactPhone: '0274 3822 123',
    contactEmail: 'vanphong.danguy@phucuong.gov.vn',
    technicalSupportContact: 'Đ/c Nguyễn Huy - Chuyên viên CNTT & Quản trị Hệ thống (0912.345.678)',
    defaultSignerTitle: 'Bí thư Đảng ủy Phường',
    driveFolderId: '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR',
    driveFolderName: 'Hồ sơ lưu trữ Văn bản Tham mưu - Phường Phú Cường',
    status: 'ACTIVE',
    adminEmails: ['nguyenhuy.thudaumot@gmail.com', 'admin.phucuong@phuong.gov.vn'],
    createdAt: '2025-01-01',
    stats: {
      totalDocuments: 142,
      totalTasks: 48,
      totalOfficers: 12
    }
  },
  {
    id: 'hiep-thanh',
    code: 'HIEP_THANH',
    name: 'Đảng ủy Phường Hiệp Thành',
    shortName: 'Phường Hiệp Thành',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'Thành phố Thủ Dầu Một',
    provinceName: 'Tỉnh Bình Dương',
    officeAddress: 'Đường Yersin, Phường Hiệp Thành, TP. Thủ Dầu Một',
    contactPhone: '0274 3824 567',
    contactEmail: 'vanphong.danguy@hiepthanh.gov.vn',
    technicalSupportContact: 'Bộ phận CNTT Thành ủy Thủ Dầu Một',
    defaultSignerTitle: 'Bí thư Đảng ủy Phường',
    driveFolderId: '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR',
    driveFolderName: 'Hồ sơ lưu trữ Văn bản Tham mưu - Phường Hiệp Thành',
    status: 'ACTIVE',
    adminEmails: ['admin.hiepthanh@phuong.gov.vn'],
    createdAt: '2025-01-05',
    stats: {
      totalDocuments: 98,
      totalTasks: 32,
      totalOfficers: 10
    }
  },
  {
    id: 'phu-hoa',
    code: 'PHU_HOA',
    name: 'Đảng ủy Phường Phú Hòa',
    shortName: 'Phường Phú Hòa',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'Thành phố Thủ Dầu Một',
    provinceName: 'Tỉnh Bình Dương',
    officeAddress: 'Đường 30/4, Phường Phú Hòa, TP. Thủ Dầu Một',
    contactPhone: '0274 3831 234',
    contactEmail: 'vanphong.danguy@phuhoa.gov.vn',
    defaultSignerTitle: 'Bí thư Đảng ủy Phường',
    status: 'ACTIVE',
    adminEmails: ['admin.phuhoa@phuong.gov.vn'],
    createdAt: '2025-01-10',
    stats: {
      totalDocuments: 115,
      totalTasks: 41,
      totalOfficers: 11
    }
  },
  {
    id: 'chanh-nghia',
    code: 'CHANH_NGHIA',
    name: 'Đảng ủy Phường Chánh Nghĩa',
    shortName: 'Phường Chánh Nghĩa',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'Thành phố Thủ Dầu Một',
    provinceName: 'Tỉnh Bình Dương',
    officeAddress: 'Đường Bùi Quốc Khánh, Phường Chánh Nghĩa, TP. Thủ Dầu Một',
    contactPhone: '0274 3823 888',
    contactEmail: 'vanphong.danguy@chanhnghia.gov.vn',
    defaultSignerTitle: 'Bí thư Đảng ủy Phường',
    status: 'ACTIVE',
    adminEmails: ['admin.chanhnghia@phuong.gov.vn'],
    createdAt: '2025-01-12',
    stats: {
      totalDocuments: 86,
      totalTasks: 27,
      totalOfficers: 9
    }
  },
  {
    id: 'phu-loi',
    code: 'PHU_LOI',
    name: 'Đảng ủy Phường Phú Lợi',
    shortName: 'Phường Phú Lợi',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'Thành phố Thủ Dầu Một',
    provinceName: 'Tỉnh Bình Dương',
    officeAddress: 'Đường Huỳnh Văn Lũy, Phường Phú Lợi, TP. Thủ Dầu Một',
    contactPhone: '0274 3825 999',
    contactEmail: 'vanphong.danguy@phuloi.gov.vn',
    defaultSignerTitle: 'Bí thư Đảng ủy Phường',
    status: 'ACTIVE',
    adminEmails: ['admin.phuloi@phuong.gov.vn'],
    createdAt: '2025-01-15',
    stats: {
      totalDocuments: 104,
      totalTasks: 35,
      totalOfficers: 10
    }
  },
  {
    id: 'dinh-hoa',
    code: 'DINH_HOA',
    name: 'Đảng ủy Phường Định Hòa',
    shortName: 'Phường Định Hòa',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'Thành phố Thủ Dầu Một',
    provinceName: 'Tỉnh Bình Dương',
    officeAddress: 'Đường Quốc lộ 13, Phường Định Hòa, TP. Thủ Dầu Một',
    contactPhone: '0274 3866 112',
    contactEmail: 'vanphong.danguy@dinhhoa.gov.vn',
    defaultSignerTitle: 'Bí thư Đảng ủy Phường',
    status: 'ACTIVE',
    adminEmails: ['admin.dinhhoa@phuong.gov.vn'],
    createdAt: '2025-01-20',
    stats: {
      totalDocuments: 75,
      totalTasks: 22,
      totalOfficers: 8
    }
  },
  {
    id: 'tan-an',
    code: 'TAN_AN',
    name: 'Đảng ủy Phường Tân An',
    shortName: 'Phường Tân An',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'Thành phố Thủ Dầu Một',
    provinceName: 'Tỉnh Bình Dương',
    officeAddress: 'Đường Nguyễn Chí Thanh, Phường Tân An, TP. Thủ Dầu Một',
    contactPhone: '0274 3861 234',
    contactEmail: 'vanphong.danguy@tanan.gov.vn',
    defaultSignerTitle: 'Bí thư Đảng ủy Phường',
    status: 'ACTIVE',
    adminEmails: ['admin.tanan@phuong.gov.vn'],
    createdAt: '2025-01-22',
    stats: {
      totalDocuments: 62,
      totalTasks: 19,
      totalOfficers: 8
    }
  },
  {
    id: 'tuong-binh-hiep',
    code: 'TUONG_BINH_HIEP',
    name: 'Đảng ủy Phường Tương Bình Hiệp',
    shortName: 'Phường Tương Bình Hiệp',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'Thành phố Thủ Dầu Một',
    provinceName: 'Tỉnh Bình Dương',
    officeAddress: 'Đường Hồ Văn Cống, Phường Tương Bình Hiệp, TP. Thủ Dầu Một',
    contactPhone: '0274 3864 555',
    contactEmail: 'vanphong.danguy@tuongbinhhiep.gov.vn',
    defaultSignerTitle: 'Bí thư Đảng ủy Phường',
    status: 'ACTIVE',
    adminEmails: ['admin.tuongbinhhiep@phuong.gov.vn'],
    createdAt: '2025-01-25',
    stats: {
      totalDocuments: 59,
      totalTasks: 18,
      totalOfficers: 7
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
    return raw ? JSON.parse(raw) : INITIAL_WARDS;
  } catch (_) {
    return INITIAL_WARDS;
  }
};

const getStoredActiveWardId = (): string => {
  if (typeof window === 'undefined') return 'phu-cuong';
  try {
    return localStorage.getItem('trolycvp_active_ward_id') || 'phu-cuong';
  } catch (_) {
    return 'phu-cuong';
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
      newActiveId = updated[0]?.id || 'phu-cuong';
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
      localStorage.setItem('trolycvp_active_ward_id', 'phu-cuong');
    }
    set({ wards: INITIAL_WARDS, activeWardId: 'phu-cuong' });
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
