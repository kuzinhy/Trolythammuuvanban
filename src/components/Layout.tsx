import { useState, useEffect, useMemo } from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router";
import { logout, db } from "../lib/firebase";
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { useAuthStore, isSystemAdmin } from "../store/authStore";
import { Document } from "../types";
import { getDocumentProgressStatus, isUrgentDocument } from "../lib/documentUtils";
import { 
  FileText, LayoutDashboard, CheckSquare, LogOut, Search, 
  Sparkles, Building2, ChevronRight, HardDrive, ExternalLink, 
  ShieldAlert, Settings, Layers, ShieldCheck, MapPin,
  Bell, BellRing, X, ArrowRight, AlertTriangle, CheckCircle2, FileSearch
} from "lucide-react";
import AIAssistant from "./AIAssistant";
import { cn } from "../lib/utils";

const TARGET_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY";

export default function Layout() {
  const { user } = useAuthStore();
  const location = useLocation();
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  
  const isAdmin = isSystemAdmin(user);

  // Realtime notification sync for urgent & overdue documents
  useEffect(() => {
    const qDocs = query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(qDocs, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Document));
      setDocuments(docs);
    }, (err) => console.error("Notification listener error:", err));

    return () => unsubscribe();
  }, []);

  // Compute urgent, overdue, and due soon documents
  const urgentAndOverdueDocs = useMemo(() => {
    return documents.filter(doc => {
      const status = getDocumentProgressStatus(doc);
      const urgent = isUrgentDocument(doc);
      return urgent || status.type === 'OVERDUE' || status.type === 'DUE_TODAY' || status.type === 'DUE_SOON';
    }).sort((a, b) => {
      const stA = getDocumentProgressStatus(a);
      const stB = getDocumentProgressStatus(b);
      if (stA.type === 'OVERDUE' && stB.type !== 'OVERDUE') return -1;
      if (stB.type === 'OVERDUE' && stA.type !== 'OVERDUE') return 1;
      if (isUrgentDocument(a) && !isUrgentDocument(b)) return -1;
      if (isUrgentDocument(b) && !isUrgentDocument(a)) return 1;
      return 0;
    });
  }, [documents]);

  const urgentCount = urgentAndOverdueDocs.length;
  const overdueCount = useMemo(() => documents.filter(d => getDocumentProgressStatus(d).type === 'OVERDUE').length, [documents]);
  const hienKhanCount = useMemo(() => documents.filter(d => isUrgentDocument(d)).length, [documents]);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Bàn làm việc & Tham mưu Văn bản';
      case '/documents': return 'Sổ Đăng ký & Quản lý Văn bản';
      case '/tasks': return 'Theo dõi & Đôn đốc Nhiệm vụ';
      case '/search': return 'Tra cứu & Thống kê Văn bản';
      case '/map': return 'Bản đồ số Địa bàn & Điểm nóng Giám sát';
      case '/directive': return 'Trợ lý Soạn thảo Ý kiến Kết luận Chỉ đạo';
      case '/audit': return 'Rà soát & Sửa lỗi Thể thức Văn bản';
      case '/admin': return 'Trung tâm Quản trị & Cấu hình Hệ thống';
      default: 
        if (location.pathname.startsWith('/documents/')) return 'Hồ sơ & Phiếu Tham mưu Văn bản';
        return 'Hệ thống Quản lý';
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      {/* Main Sidebar - Modern Royal Blue Theme */}
      <aside className="w-64 bg-gradient-to-b from-blue-950 via-blue-900 to-indigo-950 border-r border-blue-800/60 flex flex-col hidden md:flex text-blue-100 z-20">
        {/* Brand Header */}
        <div className="p-5 border-b border-blue-800/80 bg-blue-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-wider text-white">CHỈ ĐẠO CẤP ỦY</h1>
              <p className="text-[10px] text-blue-200/80 font-semibold tracking-tight">Bí thư Đảng ủy Phường</p>
            </div>
          </div>
        </div>
        
        {/* Navigation items */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-3.5">
          {/* Group 1: Operational Work */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-black text-blue-300/80 uppercase tracking-wider flex items-center justify-between">
              <span>I. Quản lý Văn bản & Bút phê</span>
            </div>

            <NavLink
              to="/documents"
              className={({ isActive }) => cn(
                "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20"
                  : "text-blue-100/90 hover:bg-blue-800/80 hover:text-white"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-4 h-4 flex-shrink-0 text-amber-300" />
                <span className="truncate">Văn bản Đến & Trình Bí thư</span>
              </div>
              {urgentCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full animate-pulse flex-shrink-0 shadow-xs">
                  {urgentCount} KHẨN
                </span>
              )}
            </NavLink>

            <NavLink
              to="/"
              end
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20"
                  : "text-blue-100/90 hover:bg-blue-800/80 hover:text-white"
              )}
            >
              <LayoutDashboard className="w-4 h-4 flex-shrink-0 text-blue-200" />
              <span className="truncate">Bàn làm việc Lãnh đạo</span>
            </NavLink>

            <NavLink
              to="/tasks"
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20"
                  : "text-blue-100/90 hover:bg-blue-800/80 hover:text-white"
              )}
            >
              <CheckSquare className="w-4 h-4 flex-shrink-0 text-blue-200" />
              <span className="truncate">Đôn đốc Nhiệm vụ Chỉ đạo</span>
            </NavLink>
          </div>

          {/* Group 2: AI & GIS Decision Support */}
          <div className="space-y-1 pt-2 border-t border-blue-800/60">
            <div className="px-3 pb-1 text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center justify-between">
              <span>II. Trợ lý AI Soạn thảo & GIS</span>
            </div>

            <NavLink
              to="/directive"
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20"
                  : "text-blue-100/90 hover:bg-blue-800/80 hover:text-white"
              )}
            >
              <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
              <span className="truncate">Soạn Kết luận & Chỉ thị AI</span>
            </NavLink>

            <NavLink
              to="/audit"
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20"
                  : "text-blue-100/90 hover:bg-blue-800/80 hover:text-white"
              )}
            >
              <FileSearch className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span className="truncate">Rà soát & Sửa lỗi Văn bản</span>
            </NavLink>

            <NavLink
              to="/search"
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20"
                  : "text-blue-100/90 hover:bg-blue-800/80 hover:text-white"
              )}
            >
              <Search className="w-4 h-4 flex-shrink-0 text-blue-200" />
              <span className="truncate">Tra cứu Quy chế & Văn bản</span>
            </NavLink>

            <NavLink
              to="/map"
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 ring-1 ring-white/20"
                  : "text-blue-100/90 hover:bg-blue-800/80 hover:text-white"
              )}
            >
              <MapPin className="w-4 h-4 text-red-300 flex-shrink-0" />
              <span className="truncate">Bản đồ Giám sát Địa bàn</span>
            </NavLink>
          </div>

          {/* Group 3: System Administration & Storage */}
          <div className="space-y-1 pt-2 border-t border-blue-800/60">
            <div className="px-3 pb-1 text-[10px] font-black text-blue-300/80 uppercase tracking-wider flex items-center justify-between">
              <span>III. Quản trị & Dữ liệu</span>
              {isAdmin && <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-300 rounded text-[9px] font-black">ADMIN</span>}
            </div>

            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                isActive
                  ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-500/25"
                  : "text-amber-200/90 hover:bg-blue-800/80 hover:text-white"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldAlert className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <span className="truncate">Quản trị Cấp cao</span>
              </div>
              {isAdmin && (
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse flex-shrink-0"></span>
              )}
            </NavLink>

            {/* Google Drive Storage Quick Link */}
            <div className="pt-0.5">
              <a
                href={TARGET_DRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-xl bg-blue-900/50 hover:bg-blue-800/80 border border-blue-700/50 text-blue-100 text-xs font-medium transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-lg bg-blue-800 border border-blue-600 flex items-center justify-center text-blue-300 flex-shrink-0">
                    <HardDrive className="w-3 h-3" />
                  </div>
                  <span className="text-[11px] font-bold text-white truncate">Google Drive Kho số</span>
                </div>
                <ExternalLink className="w-3 h-3 text-blue-300 group-hover:text-white transition-colors flex-shrink-0" />
              </a>
            </div>
          </div>
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-blue-800/80 bg-blue-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 border border-blue-400 flex items-center justify-center text-xs font-bold text-white uppercase shadow-inner">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                <span>{user?.displayName || user?.email?.split('@')[0]}</span>
                {isAdmin && (
                  <span className="px-1 py-0.2 bg-amber-400 text-blue-950 text-[8px] font-black rounded">AD</span>
                )}
              </div>
              <div className="text-[10px] text-blue-200/70 truncate">{user?.email}</div>
            </div>
            <button 
              onClick={logout} 
              className="p-1.5 rounded-lg text-blue-200/70 hover:text-red-300 hover:bg-blue-800/80 transition-colors cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
        {/* Global Top Navbar - Flat Crisp Border */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between flex-shrink-0 z-30">
          {/* Breadcrumb / Page Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="hidden sm:inline text-blue-600 font-bold">Văn phòng Cấp ủy</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="text-slate-900 font-bold text-sm tracking-tight">{getPageTitle()}</span>
            </div>

            {/* Quick Alert Ticker Banner */}
            {urgentCount > 0 && (
              <button
                onClick={() => setShowNotifPopover(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-2xs active:scale-95 animate-pulse"
                title="Nhấp để xem danh sách văn bản khẩn"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                <span>{urgentCount} Văn bản Khẩn / Trễ</span>
              </button>
            )}
          </div>

          {/* Center / Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Search Trigger Bar */}
            <Link
              to="/search"
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-medium transition-colors w-52"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">Tra cứu văn bản...</span>
              <kbd className="ml-auto px-1.5 py-0.5 bg-white text-slate-500 text-[10px] font-mono rounded border border-slate-200">Ctrl+K</kbd>
            </Link>

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifPopover(prev => !prev)}
                className={cn(
                  "relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center",
                  showNotifPopover && "bg-blue-50 text-blue-600"
                )}
                title="Thông báo văn bản khẩn & trễ hạn"
              >
                <Bell className="w-5 h-5 text-slate-700" />
                {urgentCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white ring-2 ring-white animate-pulse shadow-xs">
                    {urgentCount > 9 ? '9+' : urgentCount}
                  </span>
                )}
              </button>

              {/* Quick Notification Dropdown Popover */}
              {showNotifPopover && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Popover Header */}
                  <div className="bg-gradient-to-r from-blue-950 to-indigo-900 p-3.5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BellRing className="w-4 h-4 text-amber-300 animate-bounce" />
                      <h3 className="text-xs font-black uppercase tracking-wide">
                        Cảnh Báo Văn Bản Khẩn ({urgentCount})
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowNotifPopover(false)}
                      className="p-1 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Popover List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1.5">
                    {urgentAndOverdueDocs.length > 0 ? (
                      urgentAndOverdueDocs.slice(0, 10).map((doc) => {
                        const st = getDocumentProgressStatus(doc);
                        const isUrgent = isUrgentDocument(doc);

                        return (
                          <Link
                            key={doc.id}
                            to={`/documents/${doc.id}`}
                            onClick={() => setShowNotifPopover(false)}
                            className="block p-2.5 hover:bg-blue-50/70 rounded-xl transition-colors group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-extrabold text-blue-950 text-[11px]">
                                {doc.documentNumber || 'Số: Đang cập nhật'}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                st.type === 'OVERDUE'
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : isUrgent
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-yellow-100 text-yellow-900'
                              }`}>
                                {st.type === 'OVERDUE' ? st.label : doc.urgency || st.label}
                              </span>
                            </div>

                            <p className="text-xs font-bold text-slate-800 line-clamp-2 mt-1 group-hover:text-blue-600 transition-colors">
                              {doc.title || doc.fileName}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 font-medium">
                              <span>Cơ quan: {doc.issuer || 'N/A'}</span>
                              <span className="text-blue-600 font-bold flex items-center gap-0.5">
                                Xử lý ngay <ArrowRight className="w-2.5 h-2.5" />
                              </span>
                            </div>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-500 font-medium">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                        Không có văn bản khẩn hoặc quá hạn cần xử lý.
                      </div>
                    )}
                  </div>

                  {/* Popover Footer */}
                  <div className="bg-slate-50 p-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span className="text-[10px] text-slate-400">
                      Quá hạn: <strong className="text-red-600">{overdueCount}</strong> | Khẩn: <strong className="text-amber-600">{hienKhanCount}</strong>
                    </span>
                    <Link
                      to="/documents"
                      onClick={() => setShowNotifPopover(false)}
                      className="text-blue-600 hover:text-blue-800 text-[11px] font-extrabold flex items-center gap-1"
                    >
                      <span>Quản lý văn bản</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Gemini AI Assistant Button */}
            <button
              onClick={() => setIsAIOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors active:scale-95 group cursor-pointer"
              title="Mở Trợ lý AI Tham mưu Gemini"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Trợ lý Gemini</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </button>

            {/* Direct Google Drive Folder Button */}
            <a
              href={TARGET_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors group"
              title="Mở thư mục Google Drive lưu trữ"
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
              <span>Google Drive</span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-slate-700 transition-colors" />
            </a>

            {/* Mobile Logout Button */}
            <button 
              onClick={logout} 
              className="md:hidden p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 cursor-pointer"
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

