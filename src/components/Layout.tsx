import { useState, useEffect, useMemo } from "react";
import { Outlet, NavLink, useLocation, Link, useNavigate } from "react-router";
import { logout, db } from "../lib/firebase";
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { useAuthStore, isSystemAdmin } from "../store/authStore";
import { Document, Task } from "../types";
import { getDocumentProgressStatus, isUrgentDocument } from "../lib/documentUtils";
import { TaskReminderToasts } from "./TaskReminderToasts";
import { 
  FileText, LayoutDashboard, CheckSquare, LogOut, Search, 
  Sparkles, Building2, ChevronRight, HardDrive, ExternalLink, 
  ShieldAlert, Settings, Layers, ShieldCheck, MapPin, BarChart3,
  Bell, BellRing, X, ArrowRight, AlertTriangle, CheckCircle2, FileSearch, Bot
} from "lucide-react";
import AIAssistant from "./AIAssistant";
import { cn } from "../lib/utils";

const TARGET_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY";

export default function Layout() {
  const { user, setUser, logout: authStoreLogout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const isAdmin = isSystemAdmin(user);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error("Lỗi khi đăng xuất:", err);
    } finally {
      authStoreLogout();
      setUser(null);
      setIsLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

  // Realtime notification sync for documents and tasks
  useEffect(() => {
    const qDocs = query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribeDocs = onSnapshot(qDocs, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Document));
      setDocuments(docs);
    }, (err) => console.error("Docs notification listener error:", err));

    const qTasks = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const ts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(ts);
    }, (err) => console.error("Tasks notification listener error:", err));

    return () => {
      unsubscribeDocs();
      unsubscribeTasks();
    };
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
      {/* Main Sidebar - Pristine White & Royal Blue Tech Theme */}
      <aside className="w-64 bg-white/95 backdrop-blur-xl border-r border-blue-100 flex flex-col hidden md:flex text-slate-700 z-20 shadow-xl shadow-blue-900/5">
        {/* Brand Header */}
        <div className="p-5 border-b border-blue-100/80 bg-gradient-to-r from-blue-50/80 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-600/30 ring-2 ring-blue-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-wider text-blue-950">ĐẢNG ỦY PHƯỜNG</h1>
              <p className="text-[10px] text-blue-600 font-bold tracking-tight">Cổng Điều hành Điện tử Tech</p>
            </div>
          </div>
        </div>
        
        {/* Navigation items */}
        <nav className="flex-1 py-4 px-3.5 overflow-y-auto space-y-4">
          {/* Group 1: Core Operations */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Điều hành & Tác nghiệp</span>
            </div>

            <NavLink
              to="/"
              end
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <LayoutDashboard className="w-4 h-4 flex-shrink-0 text-blue-600 group-hover:scale-110 transition-transform" />
              <span className="truncate">Bàn làm việc</span>
            </NavLink>

            <NavLink
              to="/documents"
              className={({ isActive }) => cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 flex-shrink-0 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="truncate">Văn bản Đến</span>
              </div>
              {urgentCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full animate-pulse flex-shrink-0 shadow-xs">
                  {urgentCount}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/tasks"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <CheckSquare className="w-4 h-4 flex-shrink-0 text-blue-600 group-hover:scale-110 transition-transform" />
              <span className="truncate">Nhiệm vụ đôn đốc</span>
            </NavLink>
          </div>

          {/* Group 2: AI Intelligence & Advisory Center */}
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <div className="px-3 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Trí tuệ AI & Tham mưu</span>
              <Sparkles className="w-3 h-3 text-amber-500" />
            </div>

            <NavLink
              to="/ai-assistant"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <Bot className="w-4 h-4 text-amber-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">Trợ lý ảo Chánh VP</span>
            </NavLink>

            <NavLink
              to="/directive"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">Soạn Chỉ đạo AI</span>
            </NavLink>

            <NavLink
              to="/audit"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <FileSearch className="w-4 h-4 text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">Rà soát Thể thức</span>
            </NavLink>

            <NavLink
              to="/map"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">Bản đồ Địa bàn</span>
            </NavLink>
          </div>

          {/* Group 3: Search & Knowledge Base */}
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <div className="px-3 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Tra cứu & Kho Tri thức</span>
            </div>

            <NavLink
              to="/search"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/30"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <Search className="w-4 h-4 flex-shrink-0 text-blue-600 group-hover:scale-110 transition-transform" />
              <span className="truncate">Tra cứu & Kho Văn bản</span>
            </NavLink>
          </div>

          {/* Group 4: System Administration & Storage */}
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <div className="px-3 pb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Hệ thống</span>
              {isAdmin && <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[9px] font-black">ADMIN</span>}
            </div>

            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/25"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span className="truncate">Bộ Não AI & Quản trị</span>
              </div>
              {isAdmin && (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping flex-shrink-0"></span>
              )}
            </NavLink>
          </div>
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 border border-blue-200 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                <span>{user?.displayName || user?.email?.split('@')[0]}</span>
                {isAdmin && (
                  <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-md">AD</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 truncate">{user?.email}</div>
            </div>
            <button 
              onClick={handleLogout} 
              disabled={isLoggingOut}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Global Top Navbar - Clean Bright Glassmorphic */}
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-blue-100 px-6 flex items-center justify-between flex-shrink-0 z-30 shadow-xs">
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

            {/* GenZ Style High-Tech Live CSDL Sync Status Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/80 border border-emerald-200/80 text-emerald-800 rounded-xl text-[11px] font-bold shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>CSDL Liên thông Active</span>
            </div>
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

            {/* Gemini AI Assistant Button with GenZ Gradient & Glow */}
            <button
              onClick={() => setIsAIOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.03] active:scale-[0.97] shadow-md shadow-indigo-500/20 group cursor-pointer border border-blue-400/30"
              title="Mở Trợ lý AI Tham mưu Gemini"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin-slow group-hover:rotate-12 transition-transform" />
              <span>Trợ lý AI</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-300/40"></span>
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

            {/* Logout Button */}
            <button 
              onClick={handleLogout} 
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-transparent hover:border-red-100 disabled:opacity-50"
              title="Đăng xuất"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Đăng xuất</span>
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

      {/* GenZ Style Floating Floating AI Assistant Copilot FAB Button */}
      {!isAIOpen && (
        <button
          onClick={() => setIsAIOpen(true)}
          className="fixed bottom-6 right-6 z-40 p-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-600/30 hover:scale-110 active:scale-95 transition-all cursor-pointer group border border-white/20 flex items-center gap-2.5 backdrop-blur-md"
          title="Trợ lý AI Tham mưu Điện tử"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          </div>
          <span className="text-xs font-black uppercase tracking-wider hidden sm:inline group-hover:inline transition-all">
            Hỏi AI Tham Mưu
          </span>
        </button>
      )}

      {/* Global Task & Document Deadline Toast Notifications */}
      <TaskReminderToasts tasks={tasks} documents={documents} />
    </div>
  );
}

