import React from 'react';
import { Link, useNavigate } from 'react-router';
import { 
  ShieldAlert, Settings, Users, FolderGit2, BookOpen, 
  Database, BrainCircuit, Building2, BarChart3, ShieldCheck, 
  LogOut, ChevronRight, HardDrive, ExternalLink, Sliders, 
  Sparkles, CheckCircle2, User, Phone, Mail, HelpCircle, X,
  Landmark, MapPin
} from 'lucide-react';
import { cn } from '../lib/utils';
import { TARGET_DRIVE_FOLDER_URL } from '../lib/firebase';
import { useWardStore, isSuperAdmin, isWardAdmin } from '../store/wardStore';

interface UserAdminMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  handleLogout: () => void;
  isLoggingOut: boolean;
  isAdmin: boolean;
}

export const ADMIN_MENU_ITEMS = [
  {
    id: 'wards',
    tab: 'wards',
    title: 'Quản lý Đơn vị & Phường/Xã',
    description: 'Thêm phường mới, phân cấp Quản trị viên Phường & quản lý danh mục toàn thành phố',
    icon: Landmark,
    color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    badge: 'SuperAdmin',
    badgeColor: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
  },
  {
    id: 'system',
    tab: 'system',
    title: 'Cấu hình Đơn vị Phường & Thông số',
    description: 'Tên phường, thông tin liên hệ hỗ trợ, quy tắc ưu tiên xử lý văn bản',
    icon: Settings,
    color: 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200',
    badge: 'Phường',
    badgeColor: 'bg-blue-600 text-white'
  },
  {
    id: 'users',
    tab: 'users',
    title: 'Phân quyền Cán bộ & Vai trò',
    description: 'Cấp quyền cán bộ theo từng phường: Văn bản mật, Ký số, Huấn luyện AI...',
    icon: ShieldCheck,
    color: 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200',
    badge: 'RBAC',
    badgeColor: 'bg-amber-600 text-white'
  },
  {
    id: 'routing',
    tab: 'routing',
    title: 'Quy tắc Ưu tiên & Phân luồng',
    description: 'Ma trận thẩm quyền chỉ đạo, thời hạn xử lý và đơn vị chủ trì',
    icon: FolderGit2,
    color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
  },
  {
    id: 'brain',
    tab: 'brain',
    title: 'Bộ Não AI & Huấn luyện Tri thức',
    description: 'Học máy AI Gemini, nạp tri thức Cấp ủy & sao lưu Google Drive',
    icon: BrainCircuit,
    color: 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200'
  },
  {
    id: 'departments',
    tab: 'departments',
    title: 'Cơ cấu Phòng ban & Chi bộ',
    description: 'Danh mục khối Cấp ủy, Chính quyền, Đoàn thể và từ khóa nhận diện',
    icon: Building2,
    color: 'text-sky-600 bg-sky-50 hover:bg-sky-100 border-sky-200'
  },
  {
    id: 'officers',
    tab: 'officers',
    title: 'Danh bạ Cán bộ Tiếp nhận',
    description: 'Chuyên viên tổng hợp, lãnh đạo phê duyệt & phân công xử lý',
    icon: Users,
    color: 'text-teal-600 bg-teal-50 hover:bg-teal-100 border-teal-200'
  },
  {
    id: 'legal',
    tab: 'legal',
    title: 'Quy chuẩn Thể thức Đảng (66-QĐ/TW)',
    description: 'Mẫu biểu, căn cứ pháp lý, quy chế bảo vệ bí mật nhà nước',
    icon: BookOpen,
    color: 'text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200'
  },
  {
    id: 'database',
    tab: 'database',
    title: 'Cơ sở Dữ liệu & Sao lưu JSON',
    description: 'Liên thông CSDL trực tuyến, xuất / nhập tệp sao lưu dự phòng',
    icon: Database,
    color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
  },
  {
    id: 'reports',
    tab: 'reports',
    title: 'Báo cáo Thống kê Định kỳ',
    description: 'Tổng hợp văn bản, nhiệm vụ, hiệu suất cán bộ và in báo cáo',
    icon: BarChart3,
    color: 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200'
  }
];

export default function UserAdminMenu({
  isOpen,
  onClose,
  user,
  handleLogout,
  isLoggingOut,
  isAdmin
}: UserAdminMenuProps) {
  const navigate = useNavigate();
  const { getActiveWard } = useWardStore();
  const activeWard = getActiveWard();

  if (!isOpen) return null;

  const isSuper = isSuperAdmin(user);
  const isWardAdm = isWardAdmin(user, activeWard?.id);

  const handleNavigateTab = (tab: string) => {
    navigate(`/admin?tab=${tab}`);
    onClose();
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Cán bộ Cấp ủy';
  
  let roleTitle = 'Chuyên viên Văn phòng Cấp ủy';
  if (isSuper) {
    roleTitle = 'Quản trị viên Cấp cao Toàn hệ thống (SuperAdmin)';
  } else if (isWardAdm) {
    roleTitle = `Quản trị viên ${activeWard?.shortName || 'Phường'}`;
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Dropdown Menu Container */}
      <div className="fixed top-18 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[500px] max-h-[88vh] bg-white/98 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* User Card Header */}
        <div className="p-5 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white relative flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 border-2 border-white/40 flex items-center justify-center text-base font-black text-white uppercase shadow-md">
                  {displayName.charAt(0)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-blue-950 rounded-full" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white truncate">{displayName}</h2>
                  {isSuper ? (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[9px] font-black uppercase tracking-wider rounded-md border border-purple-400/40">
                      SUPER ADMIN
                    </span>
                  ) : isWardAdm ? (
                    <span className="px-2 py-0.5 bg-blue-500/80 text-white text-[9px] font-black uppercase tracking-wider rounded-md border border-blue-400/40">
                      ADMIN PHƯỜNG
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-blue-200 font-medium truncate">{user?.email}</p>
                <div className="text-[11px] text-blue-300/90 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="truncate">{roleTitle}</span>
                  <span>•</span>
                  <span className="text-emerald-300 flex-shrink-0">Online</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
              title="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Ward Badge inside Card */}
          <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-blue-200 min-w-0">
              <Landmark className="w-4 h-4 text-blue-300 flex-shrink-0" />
              <span className="font-bold truncate">Đơn vị: {activeWard?.name}</span>
            </div>
            <span className="text-[10px] font-bold text-blue-300 bg-white/10 px-2 py-0.5 rounded-full flex-shrink-0">
              {activeWard?.districtName}
            </span>
          </div>
        </div>

        {/* Scrollable Body: Dedicated Admin Menu */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Admin Menu Section Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Menu Quản trị & Cài đặt Cấp ủy
              </span>
            </div>
            <Link
              to="/admin"
              onClick={onClose}
              className="text-[11px] font-extrabold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 group"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Admin Sub-modules Grid */}
          <div className="grid grid-cols-1 gap-2">
            {ADMIN_MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigateTab(item.tab)}
                  className="w-full text-left p-3 rounded-2xl border border-slate-100 hover:border-blue-200 bg-slate-50/70 hover:bg-blue-50/60 transition-all flex items-start gap-3 group cursor-pointer active:scale-[0.99]"
                >
                  <div className={cn("p-2.5 rounded-xl border flex-shrink-0 transition-transform group-hover:scale-105", item.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                        {item.title}
                      </h4>
                      {item.badge && (
                        <span className={cn("px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider flex-shrink-0", item.badgeColor)}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-2" />
                </button>
              );
            })}
          </div>

          {/* Quick Storage & Help Links */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <a
              href={TARGET_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
              <span>Google Drive Phường</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <Link
              to="/admin?tab=system"
              onClick={onClose}
              className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Hỗ trợ kỹ thuật</span>
            </Link>
          </div>
        </div>

        {/* Footer Actions: Admin Page & Logout */}
        <div className="p-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => {
              navigate('/admin');
              onClose();
            }}
            className="px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>Trung tâm Quản trị</span>
          </button>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5 text-red-600" />
            <span>{isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
          </button>
        </div>
      </div>
    </>
  );
}
