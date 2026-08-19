import { useState } from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router";
import { logout } from "../lib/firebase";
import { useAuthStore, isSystemAdmin } from "../store/authStore";
import { 
  FileText, LayoutDashboard, CheckSquare, LogOut, Search, 
  Sparkles, Building2, ChevronRight, HardDrive, ExternalLink, 
  ShieldAlert, Settings, Layers, ShieldCheck
} from "lucide-react";
import AIAssistant from "./AIAssistant";
import { cn } from "../lib/utils";

const TARGET_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY";

export default function Layout() {
  const { user } = useAuthStore();
  const location = useLocation();
  const [isAIOpen, setIsAIOpen] = useState(false);
  const isAdmin = isSystemAdmin(user);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Bàn làm việc & Tham mưu Văn bản';
      case '/documents': return 'Sổ Đăng ký & Quản lý Văn bản';
      case '/tasks': return 'Theo dõi & Đôn đốc Nhiệm vụ';
      case '/search': return 'Tra cứu & Thống kê Văn bản';
      case '/directive': return 'Trợ lý Soạn thảo Ý kiến Kết luận Chỉ đạo';
      case '/admin': return 'Trung tâm Quản trị & Cấu hình Hệ thống';
      default: 
        if (location.pathname.startsWith('/documents/')) return 'Hồ sơ & Phiếu Tham mưu Văn bản';
        return 'Hệ thống Quản lý';
    }
  };

  return (
    <div className="flex h-screen bg-[#EEF4FF] font-sans text-slate-800 overflow-hidden">
      {/* Main Sidebar - Luminous Royal Blue & Modern Sapphire */}
      <aside className="w-64 bg-gradient-to-b from-blue-900 via-slate-900 to-blue-950 backdrop-blur-xl border-r border-blue-800/40 flex flex-col hidden md:flex text-slate-200 z-20 shadow-2xl shadow-blue-900/20">
        {/* Brand Header */}
        <div className="p-5 border-b border-blue-800/40 bg-gradient-to-b from-blue-950/80 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 via-blue-600 to-cyan-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 ring-2 ring-white/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-wider text-white">TRỢ LÝ THAM MƯU</h1>
              <p className="text-[10px] text-blue-200 font-semibold tracking-tight">Cấp ủy & Chính quyền</p>
            </div>
          </div>
        </div>
        
        {/* Navigation items */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1.5">
          <div className="px-3 pb-2 text-[10px] font-bold text-blue-300/80 uppercase tracking-wider">Tác nghiệp chính</div>
          
          <NavLink
            to="/"
            end
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
              isActive
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 ring-1 ring-white/20 font-bold translate-x-1"
                : "text-blue-100/90 hover:bg-white/10 hover:text-white hover:translate-x-0.5"
            )}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span>Tổng quan tham mưu</span>
          </NavLink>

          <NavLink
            to="/documents"
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
              isActive
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 ring-1 ring-white/20 font-bold translate-x-1"
                : "text-blue-100/90 hover:bg-white/10 hover:text-white hover:translate-x-0.5"
            )}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span>Kho văn bản</span>
          </NavLink>

          <NavLink
            to="/tasks"
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
              isActive
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 ring-1 ring-white/20 font-bold translate-x-1"
                : "text-blue-100/90 hover:bg-white/10 hover:text-white hover:translate-x-0.5"
            )}
          >
            <CheckSquare className="w-4 h-4 flex-shrink-0" />
            <span>Theo dõi nhiệm vụ</span>
          </NavLink>

          <NavLink
            to="/search"
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
              isActive
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 ring-1 ring-white/20 font-bold translate-x-1"
                : "text-blue-100/90 hover:bg-white/10 hover:text-white hover:translate-x-0.5"
            )}
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span>Tra cứu thông minh</span>
          </NavLink>

          <NavLink
            to="/directive"
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
              isActive
                ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/30 ring-1 ring-white/20 font-bold translate-x-1"
                : "text-blue-100/90 hover:bg-white/10 hover:text-white hover:translate-x-0.5"
            )}
          >
            <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <span>Tham mưu chỉ đạo</span>
          </NavLink>

          {/* Admin Navigation Item - Exclusively highlighted for Admin */}
          <div className="pt-3">
            <div className="px-3 pb-2 text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
              <span>Hệ thống Quản trị</span>
              <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-300 rounded text-[9px] font-extrabold">ADMIN</span>
            </div>

            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30 ring-1 ring-white/20 font-bold translate-x-1"
                  : "text-amber-100 hover:bg-amber-500/10 hover:text-amber-200 hover:translate-x-0.5"
              )}
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Quản trị Cấp cao</span>
              </div>
              {isAdmin && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              )}
            </NavLink>
          </div>

          {/* Google Drive Storage Quick Link */}
          <div className="pt-3 px-1">
            <a
              href={TARGET_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-br from-blue-800/40 to-indigo-900/40 hover:from-blue-700/50 hover:to-indigo-800/50 border border-blue-400/20 text-blue-100 text-xs font-medium transition-all group shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/30 border border-blue-300/30 flex items-center justify-center text-blue-200">
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-white block">Google Drive</span>
                  <span className="text-[9px] text-blue-200">Kho lưu trữ số</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-blue-300 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </a>
          </div>
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-blue-800/40 bg-blue-950/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 border border-blue-300/30 flex items-center justify-center text-xs font-bold text-white uppercase shadow-inner">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                <span>{user?.displayName || user?.email?.split('@')[0]}</span>
                {isAdmin && (
                  <span className="px-1 py-0.2 bg-amber-400 text-slate-900 text-[8px] font-black rounded">AD</span>
                )}
              </div>
              <div className="text-[10px] text-blue-200/80 truncate">{user?.email}</div>
            </div>
            <button 
              onClick={logout} 
              className="p-1.5 rounded-lg text-blue-200 hover:text-red-300 hover:bg-white/10 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-blue-50/50 via-slate-50 to-indigo-50/40">
        {/* Global Top Navbar - Frosted Glass Blur */}
        <header className="h-16 bg-white/85 backdrop-blur-md border-b border-blue-100 px-6 flex items-center justify-between flex-shrink-0 z-10 shadow-xs">
          {/* Breadcrumb / Page Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="hidden sm:inline text-blue-600 font-semibold">Văn phòng Tham mưu</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="text-slate-900 font-bold text-sm tracking-tight">{getPageTitle()}</span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Gemini AI Assistant Button */}
            <button
              onClick={() => setIsAIOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 active:scale-95 group"
              title="Mở Trợ lý AI Tham mưu Gemini"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Trợ lý Gemini</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </button>

            {/* Direct Google Drive Folder Button */}
            <a
              href={TARGET_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/90 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs group"
              title="Mở thư mục Google Drive lưu trữ"
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-600 group-hover:text-white transition-colors" />
              <span>Google Drive</span>
              <ExternalLink className="w-3 h-3 text-blue-400 group-hover:text-white transition-colors" />
            </a>

            {/* Mobile Logout Button */}
            <button 
              onClick={logout} 
              className="md:hidden p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
      
      {/* On-Demand AI Assistant Drawer */}
      <AIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  );
}
