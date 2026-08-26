import React, { useState } from 'react';
import { 
  Landmark, Plus, Search, Building2, ShieldCheck, Mail, Phone, MapPin, 
  HardDrive, ExternalLink, CheckCircle2, Edit3, Trash2, ArrowRight, 
  RefreshCw, Check, AlertCircle, Users, FileText, CheckSquare, Sparkles,
  Shield, UserPlus, Key, ChevronRight, Sliders
} from 'lucide-react';
import { WardUnit } from '../../types';
import { useWardStore, isSuperAdmin, isWardAdmin } from '../../store/wardStore';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';

interface WardsAdminTabProps {
  onNavigateTab?: (tab: string, filterWardId?: string) => void;
}

export default function WardsAdminTab({ onNavigateTab }: WardsAdminTabProps) {
  const { user } = useAuthStore();
  const { 
    wards, 
    activeWardId, 
    setActiveWardId, 
    addWard, 
    updateWard, 
    deleteWard, 
    addAdminEmailToWard, 
    removeAdminEmailFromWard,
    getActiveWard,
    resetToDefaults
  } = useWardStore();

  const isSuper = isSuperAdmin(user);
  const activeWard = getActiveWard();

  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWard, setEditingWard] = useState<WardUnit | null>(null);
  const [managingAdminsWard, setManagingAdminsWard] = useState<WardUnit | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // New ward form state
  const [newWardForm, setNewWardForm] = useState({
    code: '',
    name: '',
    shortName: '',
    parentOrg: 'Thành ủy Thủ Dầu Một',
    districtName: 'TP. Thủ Dầu Một',
    officeAddress: '',
    contactPhone: '',
    contactEmail: '',
    driveFolderId: '',
    adminEmailsStr: '',
    isActive: true
  });

  const showNotification = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Distinct districts
  const districts = Array.from(new Set(wards.map(w => w.districtName).filter(Boolean)));

  const filteredWards = wards.filter(w => {
    if (districtFilter !== 'ALL' && w.districtName !== districtFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return w.name.toLowerCase().includes(q) ||
           w.shortName.toLowerCase().includes(q) ||
           w.code.toLowerCase().includes(q) ||
           w.parentOrg.toLowerCase().includes(q) ||
           (w.contactEmail && w.contactEmail.toLowerCase().includes(q)) ||
           w.adminEmails.some(e => e.toLowerCase().includes(q));
  });

  const handleCreateWard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWardForm.name.trim() || !newWardForm.code.trim()) {
      alert('Vui lòng nhập tên phường và mã định danh.');
      return;
    }

    const adminEmails = newWardForm.adminEmailsStr
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    // Auto-include superadmin if not present
    if (!adminEmails.includes('nguyenhuy.thudaumot@gmail.com')) {
      adminEmails.push('nguyenhuy.thudaumot@gmail.com');
    }

    const newWard: WardUnit = {
      id: `ward_${newWardForm.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
      code: newWardForm.code.toUpperCase().replace(/\s+/g, '_'),
      name: newWardForm.name.trim(),
      shortName: newWardForm.shortName.trim() || newWardForm.name.trim(),
      parentOrg: newWardForm.parentOrg.trim() || 'Thành ủy Thủ Dầu Một',
      districtName: newWardForm.districtName.trim() || 'TP. Thủ Dầu Một',
      provinceName: 'Tỉnh Bình Dương',
      officeAddress: newWardForm.officeAddress.trim(),
      contactPhone: newWardForm.contactPhone.trim(),
      contactEmail: newWardForm.contactEmail.trim(),
      defaultSignerTitle: 'Bí thư Đảng ủy Phường',
      driveFolderId: newWardForm.driveFolderId.trim() || undefined,
      status: newWardForm.isActive ? 'ACTIVE' : 'INACTIVE',
      adminEmails,
      isActive: newWardForm.isActive,
      createdAt: new Date().toISOString()
    };

    addWard(newWard);
    setShowAddModal(false);
    setNewWardForm({
      code: '',
      name: '',
      shortName: '',
      parentOrg: 'Thành ủy Thủ Dầu Một',
      districtName: 'TP. Thủ Dầu Một',
      officeAddress: '',
      contactPhone: '',
      contactEmail: '',
      driveFolderId: '',
      adminEmailsStr: '',
      isActive: true
    });
    showNotification(`Đã tạo thành công đơn vị "${newWard.name}"!`);
  };

  const handleUpdateWardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWard) return;

    updateWard(editingWard.id, editingWard);
    setEditingWard(null);
    showNotification(`Đã cập nhật thông tin đơn vị "${editingWard.name}"!`);
  };

  const handleAddAdminEmail = (wardId: string) => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      alert('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    addAdminEmailToWard(wardId, email);
    setNewAdminEmail('');
    showNotification(`Đã cấp quyền Quản trị viên Phường cho "${email}"!`);
  };

  const handleRemoveAdminEmail = (wardId: string, email: string) => {
    if (email === 'nguyenhuy.thudaumot@gmail.com') {
      alert('Không thể xóa SuperAdmin toàn hệ thống khỏi danh sách quản trị.');
      return;
    }
    if (window.confirm(`Xác nhận thu hồi quyền Quản trị viên Phường của "${email}"?`)) {
      removeAdminEmailFromWard(wardId, email);
      showNotification(`Đã thu hồi quyền quản trị của "${email}"!`);
    }
  };

  const totalDesignatedAdmins = Array.from(new Set(wards.flatMap(w => w.adminEmails))).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {saveSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 border border-emerald-500">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 flex-shrink-0" />
          <span className="text-xs font-bold">{saveSuccessMsg}</span>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="bg-white/95 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-blue-200/80 shadow-md space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
              <Landmark className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  Quản Trị Đa Phường / Đơn Vị (Multi-Tenancy Architecture)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[10px] font-black border border-purple-300 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-600" />
                  SUPER ADMIN & ADMIN PHƯỜNG
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-3xl">
                Cơ chế phân quyền liên thông đa cấp: <strong>SuperAdmin</strong> quản lý toàn bộ hệ thống các phường, thêm đơn vị mới và cấp quyền; <strong>Admin Phường</strong> chỉ quản lý cán bộ, văn bản và nhiệm vụ của riêng phường đó.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSuper && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Phường / Đơn vị Mới</span>
              </button>
            )}

            <button
              onClick={() => {
                if (window.confirm("Đồng chí có chắc muốn đặt lại danh sách phường về cấu hình ban đầu?")) {
                  resetToDefaults();
                  showNotification("Đã khôi phục danh mục phường mặc định!");
                }
              }}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Khôi phục Mặc định</span>
            </button>
          </div>
        </div>

        {/* Statistics Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-indigo-700">Tổng Đơn vị Phường/Xã</span>
              <Landmark className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-950">
              {wards.length}
            </div>
            <div className="text-[10px] text-indigo-600 font-medium">
              {wards.filter(w => w.isActive).length} đang hoạt động
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-blue-700">Quản trị viên Được Cấp Quyền</span>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-950">
              {totalDesignatedAdmins}
            </div>
            <div className="text-[10px] text-blue-600 font-medium">Phân quyền theo email</div>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-purple-700">Đơn Vị Đang Chọn</span>
              <Building2 className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-sm font-black text-purple-950 truncate">
              {activeWard?.shortName || activeWard?.name}
            </div>
            <div className="text-[10px] text-purple-600 font-medium truncate">
              Mã: {activeWard?.code}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-700">Cơ Chế Phân Quyền</span>
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-sm font-black text-emerald-950">
              {isSuper ? 'SuperAdmin' : isWardAdmin(user, activeWardId) ? 'Admin Phường' : 'Chuyên viên'}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">Cách ly dữ liệu tự động</div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm phường, mã định danh, địa chỉ, email quản trị viên..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {districts.length > 1 && (
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">Tất cả Quận / Thị xã / Thành phố</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Wards Grid / Directory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredWards.map((ward) => {
          const isCurrentActive = ward.id === activeWardId;
          const isUserAdminOfThisWard = isWardAdmin(user, ward.id);

          return (
            <div
              key={ward.id}
              className={cn(
                "bg-white rounded-3xl p-5 md:p-6 border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md",
                isCurrentActive 
                  ? "border-blue-500 ring-2 ring-blue-500/20 bg-gradient-to-br from-blue-50/40 via-white to-white" 
                  : "border-slate-200/80 hover:border-blue-200"
              )}
            >
              {/* Top Card Info */}
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 shadow-xs",
                      isCurrentActive 
                        ? "bg-blue-600 text-white" 
                        : "bg-slate-100 text-slate-700"
                    )}>
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">{ward.name}</h3>
                        {isCurrentActive && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                            <Check className="w-2.5 h-2.5" />
                            ĐANG CHỌN
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-blue-600 font-bold mt-0.5">
                        {ward.parentOrg} • {ward.districtName}
                      </p>
                    </div>
                  </div>

                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
                    ward.isActive 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  )}>
                    {ward.isActive ? 'HOẠT ĐỘNG' : 'TẠM DỪNG'}
                  </span>
                </div>

                {/* Ward Details */}
                <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-slate-600">
                  {ward.officeAddress && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{ward.officeAddress}</span>
                    </div>
                  )}
                  {ward.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{ward.contactPhone}</span>
                    </div>
                  )}
                  {ward.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{ward.contactEmail}</span>
                    </div>
                  )}
                </div>

                {/* Designated Admins List */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                      Quản trị viên được cấp quyền ({ward.adminEmails.length}):
                    </span>
                    {(isSuper || isUserAdminOfThisWard) && (
                      <button
                        type="button"
                        onClick={() => setManagingAdminsWard(ward)}
                        className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                      >
                        + Cấp quyền Email
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {ward.adminEmails.map((email) => {
                      const isMaster = email === 'nguyenhuy.thudaumot@gmail.com';
                      return (
                        <span
                          key={email}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border",
                            isMaster 
                              ? "bg-purple-50 text-purple-800 border-purple-200" 
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          )}
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                          <span>{email}</span>
                          {isMaster && <span className="text-[8px] bg-purple-200 text-purple-900 px-1 rounded">Super</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {!isCurrentActive ? (
                    <button
                      onClick={() => {
                        setActiveWardId(ward.id);
                        showNotification(`Đã chuyển không gian làm việc sang "${ward.name}"!`);
                      }}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Chọn Phường này</span>
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Không gian hiện tại
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {(isSuper || isUserAdminOfThisWard) && (
                    <button
                      onClick={() => setEditingWard(ward)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Chỉnh sửa thông số phường"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}

                  {isSuper && (
                    <button
                      onClick={() => {
                        if (ward.id === 'ward_phu_cuong') {
                          alert('Không thể xóa phường trụ sở chính mặc định.');
                          return;
                        }
                        if (window.confirm(`Xác nhận xóa hoàn toàn đơn vị "${ward.name}"?`)) {
                          deleteWard(ward.id);
                          showNotification(`Đã xóa đơn vị "${ward.name}"!`);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Xóa đơn vị"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        setActiveWardId(ward.id);
                        onNavigateTab('users', ward.id);
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Cán bộ</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD NEW WARD */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-blue-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Landmark className="w-5 h-5 text-blue-300" />
                <h3 className="text-sm font-black uppercase tracking-wide">
                  Thêm Phường / Đơn Vị Mới Vào Hệ Thống
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWard} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tên Đơn vị / Phường *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Đảng ủy Phường Phú Hòa"
                    value={newWardForm.name}
                    onChange={(e) => setNewWardForm({ ...newWardForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tên Rút Gọn / Hiển Thị *</label>
                  <input
                    type="text"
                    placeholder="VD: Đảng ủy P. Phú Hòa"
                    value={newWardForm.shortName}
                    onChange={(e) => setNewWardForm({ ...newWardForm, shortName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Mã Định Danh Duy Nhất *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: PHU_HOA"
                    value={newWardForm.code}
                    onChange={(e) => setNewWardForm({ ...newWardForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Quận / Huyện / TP</label>
                  <input
                    type="text"
                    placeholder="VD: TP. Thủ Dầu Một"
                    value={newWardForm.districtName}
                    onChange={(e) => setNewWardForm({ ...newWardForm, districtName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Cơ quan Cấp trên Trực tiếp</label>
                <input
                  type="text"
                  placeholder="VD: Thành ủy Thủ Dầu Một"
                  value={newWardForm.parentOrg}
                  onChange={(e) => setNewWardForm({ ...newWardForm, parentOrg: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Số Điện thoại Trực ban</label>
                  <input
                    type="text"
                    placeholder="VD: 0274.3822.xxx"
                    value={newWardForm.contactPhone}
                    onChange={(e) => setNewWardForm({ ...newWardForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email Công vụ</label>
                  <input
                    type="email"
                    placeholder="VD: vanphong.phuhoa@binhduong.gov.vn"
                    value={newWardForm.contactEmail}
                    onChange={(e) => setNewWardForm({ ...newWardForm, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Địa chỉ Trụ sở Đảng ủy</label>
                <input
                  type="text"
                  placeholder="VD: Số 123 đường 30/4, P. Phú Hòa, TP. TDM"
                  value={newWardForm.officeAddress}
                  onChange={(e) => setNewWardForm({ ...newWardForm, officeAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Email Quản trị viên Phường Ban đầu (Phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  placeholder="VD: admin.phuhoa@binhduong.gov.vn, bi.thu.phuhoa@gmail.com"
                  value={newWardForm.adminEmailsStr}
                  onChange={(e) => setNewWardForm({ ...newWardForm, adminEmailsStr: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500">
                  Các email này sẽ có toàn quyền Admin trên dữ liệu của phường mới này.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Xác nhận Tạo Phường
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT WARD DETAILS */}
      {editingWard && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-blue-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-blue-300" />
                <h3 className="text-sm font-black uppercase tracking-wide">
                  Chỉnh Sửa Thông Số Đơn Vị: {editingWard.shortName}
                </h3>
              </div>
              <button
                onClick={() => setEditingWard(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateWardSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tên Đơn vị Phường *</label>
                  <input
                    type="text"
                    required
                    value={editingWard.name}
                    onChange={(e) => setEditingWard({ ...editingWard, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tên Rút Gọn *</label>
                  <input
                    type="text"
                    required
                    value={editingWard.shortName}
                    onChange={(e) => setEditingWard({ ...editingWard, shortName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Mã Định Danh</label>
                  <input
                    type="text"
                    disabled
                    value={editingWard.code}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Trực thuộc Cấp trên</label>
                  <input
                    type="text"
                    value={editingWard.parentOrg}
                    onChange={(e) => setEditingWard({ ...editingWard, parentOrg: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Số Điện thoại</label>
                  <input
                    type="text"
                    value={editingWard.contactPhone || ''}
                    onChange={(e) => setEditingWard({ ...editingWard, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email Công vụ</label>
                  <input
                    type="email"
                    value={editingWard.contactEmail || ''}
                    onChange={(e) => setEditingWard({ ...editingWard, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Địa chỉ Trụ sở</label>
                <input
                  type="text"
                  value={editingWard.officeAddress || ''}
                  onChange={(e) => setEditingWard({ ...editingWard, officeAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Thư mục Google Drive (Folder ID)</label>
                <input
                  type="text"
                  value={editingWard.driveFolderId || ''}
                  onChange={(e) => setEditingWard({ ...editingWard, driveFolderId: e.target.value })}
                  placeholder="VD: 1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="wardIsActive"
                  checked={editingWard.isActive}
                  onChange={(e) => setEditingWard({ ...editingWard, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="wardIsActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Đơn vị đang hoạt động (Hiển thị trong danh mục tiếp nhận)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingWard(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE WARD ADMIN EMAILS */}
      {managingAdminsWard && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-blue-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">
                    Cấp Quyền Quản Trị Viên Phường
                  </h3>
                  <p className="text-[10px] text-blue-200 font-bold">{managingAdminsWard.name}</p>
                </div>
              </div>
              <button
                onClick={() => setManagingAdminsWard(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-700" />
                  Quyền hạn của Quản trị viên Phường:
                </div>
                <p className="text-[11px] text-amber-800">
                  Tài khoản có email trong danh sách này khi đăng nhập sẽ có quyền quản trị toàn bộ danh mục Cán bộ, Phòng ban, Quy tắc, Văn bản và Nhiệm vụ của <strong>{managingAdminsWard.shortName}</strong>.
                </p>
              </div>

              {/* Add email input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Thêm Email Quản trị viên mới</label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="VD: canbo.quantri@binhduong.gov.vn"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAdminEmail(managingAdminsWard.id);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddAdminEmail(managingAdminsWard.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex-shrink-0"
                  >
                    + Cấp Quyền
                  </button>
                </div>
              </div>

              {/* List of current admins */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-700">
                  Danh sách Quản trị viên hiện tại ({managingAdminsWard.adminEmails.length})
                </label>

                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto border border-slate-200 rounded-2xl">
                  {managingAdminsWard.adminEmails.map((email) => {
                    const isMaster = email === 'nguyenhuy.thudaumot@gmail.com';
                    return (
                      <div key={email} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                            isMaster ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"
                          )}>
                            {email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{email}</p>
                            <p className="text-[10px] text-slate-400">
                              {isMaster ? 'SuperAdmin toàn hệ thống' : 'Quản trị viên đơn vị'}
                            </p>
                          </div>
                        </div>

                        {!isMaster && (isSuper || isWardAdmin(user, managingAdminsWard.id)) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAdminEmail(managingAdminsWard.id, email)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                            title="Thu hồi quyền quản trị"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setManagingAdminsWard(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
