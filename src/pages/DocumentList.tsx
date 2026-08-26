import { useEffect, useState, useMemo, MouseEvent } from 'react';
import { collection, query, orderBy, onSnapshot, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Document } from '../types';
import { 
  Eye, Loader2, Search, Plus, Printer, ShieldAlert, 
  HardDrive, ExternalLink, Clock, AlertTriangle, CheckCircle2, Calendar, Tag,
  FileText, Check, X, ShieldCheck, Filter, Star, User, Download, BookOpen,
  ChevronDown, ChevronUp, Layers, RefreshCw, Sparkles, Building2
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { useWardStore } from '../store/wardStore';
import DispatchSlip from '../components/DispatchSlip';
import { getDocumentTags, getTagStyle, STANDARD_TAGS } from '../lib/tagUtils';
import { 
  getDocumentProgressStatus, 
  isDocumentCompleted,
  parseDateString,
  ADMINISTRATIVE_DOC_TYPES,
  matchDocumentType,
  matchDocumentDateRange,
  formatDateToYMD,
  formatDateToDMY
} from '../lib/documentUtils';

export type ProgressFilter = 'ALL' | 'IMPORTANT' | 'MY_UPLOADS' | 'COMPLETED' | 'OVERDUE' | 'DUE_TODAY' | 'IN_TIME' | 'STANDING_BOARD' | 'URGENT' | 'DRIVE';

export default function DocumentList() {
  const { user } = useAuthStore();
  const { activeWardId, getActiveWard } = useWardStore();
  const activeWard = getActiveWard();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const initialFilter = (searchParams.get('filter') as ProgressFilter) || 'ALL';
  const [filterType, setFilterType] = useState<ProgressFilter>(initialFilter);
  const [selectedSlipDoc, setSelectedSlipDoc] = useState<Document | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');
  const [selectedDocType, setSelectedDocType] = useState<string>('ALL');
  const [starTogglingId, setStarTogglingId] = useState<string | null>(null);

  // Date Range Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateFieldType, setDateFieldType] = useState<'ALL' | 'ISSUED_DATE' | 'RECEIVED_OR_CREATED' | 'DEADLINE'>('ALL');
  const [activeDatePreset, setActiveDatePreset] = useState<string>('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [showIncomingRegisterModal, setShowIncomingRegisterModal] = useState<boolean>(false);

  useEffect(() => {
    const urlFilter = searchParams.get('filter') as ProgressFilter;
    if (urlFilter && urlFilter !== filterType) {
      setFilterType(urlFilter);
    }
  }, [searchParams]);

  const [deputyChiefs] = useState<string[]>(() => {
    const saved = localStorage.getItem('trolycvp_officers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const deputies = parsed.filter((o: any) => o.roleType === 'DEPUTY_CHIEF').map((o: any) => `${o.fullName} - Phó Chánh VP`);
        if (deputies.length > 0) return deputies;
      } catch (e) {}
    }
    return [
      'Đ/c Nguyễn Văn Hùng - Phó Chánh VP',
      'Đ/c Lê Thị Minh - Phó Chánh VP',
      'Đ/c Trần Quốc Tuấn - Phó Chánh VP',
      'Đ/c Hoàng Văn Nam - Phó Chánh VP'
    ];
  });

  const handleApplyDatePreset = (preset: string) => {
    setActiveDatePreset(preset);
    const now = new Date();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'TODAY') {
      const todayStr = formatDateToYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7_DAYS') {
      const past = new Date();
      past.setDate(now.getDate() - 7);
      setStartDate(formatDateToYMD(past));
      setEndDate(formatDateToYMD(now));
    } else if (preset === '30_DAYS') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      setStartDate(formatDateToYMD(past));
      setEndDate(formatDateToYMD(now));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatDateToYMD(firstDay));
      setEndDate(formatDateToYMD(lastDay));
    } else if (preset === 'THIS_QUARTER') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(now.getFullYear(), currentQuarter * 3, 1);
      const lastDay = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0);
      setStartDate(formatDateToYMD(firstDay));
      setEndDate(formatDateToYMD(lastDay));
    } else if (preset === 'THIS_YEAR') {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      setStartDate(formatDateToYMD(firstDay));
      setEndDate(formatDateToYMD(lastDay));
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterType('ALL');
    setSelectedTagFilter('ALL');
    setSelectedDocType('ALL');
    setStartDate('');
    setEndDate('');
    setDateFieldType('ALL');
    setActiveDatePreset('ALL');
  };

  const handleToggleStar = async (e: MouseEvent, docItem: Document) => {
    e.stopPropagation();
    if (!docItem.id) return;
    
    setStarTogglingId(docItem.id);
    const newStatus = !(docItem.isImportant || docItem.isStarred);
    
    try {
      await updateDoc(doc(db, 'documents', docItem.id), {
        isImportant: newStatus,
        isStarred: newStatus,
      });
    } catch (err) {
      console.error("Lỗi khi cập nhật trạng thái quan trọng:", err);
    } finally {
      setStarTogglingId(null);
    }
  };

  const handleUpdateDeputyChief = async (docId: string, deputy: string) => {
    try {
      await updateDoc(doc(db, 'documents', docId), { assignedDeputyChief: deputy });
    } catch (err) {
      console.error("Error updating assigned deputy chief:", err);
    }
  };

  const handleUpdateProcessingResult = async (docId: string, result: string) => {
    try {
      await updateDoc(doc(db, 'documents', docId), { processingResult: result });
    } catch (err) {
      console.error("Error updating processing result:", err);
    }
  };

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 120);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    let isMounted = true;
    const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(150));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isMounted) return;
      const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
      setDocuments(docsData);
      setLoading(false);
    }, (error) => {
      console.error("Realtime sync error on documents:", error);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const filteredDocs = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    return documents.filter(doc => {
      // Multi-ward isolation filter
      if (activeWardId !== 'all') {
        if (doc.wardId && doc.wardId !== activeWardId) return false;
      }

      const docTags = getDocumentTags(doc);

      if (selectedTagFilter !== 'ALL') {
        if (!docTags.includes(selectedTagFilter)) return false;
      }

      if (selectedDocType !== 'ALL') {
        if (!matchDocumentType(doc, selectedDocType)) return false;
      }

      if (startDate || endDate) {
        if (!matchDocumentDateRange(doc, startDate, endDate, dateFieldType)) return false;
      }

      if (term) {
        const matchesSearch = 
          (doc.documentNumber || '').toLowerCase().includes(term) ||
          (doc.title || doc.fileName || '').toLowerCase().includes(term) ||
          (doc.issuer || '').toLowerCase().includes(term) ||
          (doc.leadDepartment || '').toLowerCase().includes(term) ||
          (doc.proposedAction || '').toLowerCase().includes(term) ||
          (doc.actionDeadline || '').toLowerCase().includes(term) ||
          (doc.summary || '').toLowerCase().includes(term) ||
          docTags.some(t => t.toLowerCase().includes(term));

        if (!matchesSearch) return false;
      }

      const status = getDocumentProgressStatus(doc);

      if (filterType === 'IMPORTANT') {
        const u = (doc.urgency || '').toUpperCase();
        const isUrgent = u.includes('HOA_TOC') || u.includes('HỎA TỐC') || u.includes('THUONG_KHAN') || u.includes('THƯỢNG KHẨN') || u.includes('KHẨN');
        const isStanding = (doc.proposedAction || '').includes('Ban Thường vụ') || (doc.proposedAction || '').includes('Thường trực');
        return !!(doc.isImportant || doc.isStarred || isUrgent || isStanding);
      }
      if (filterType === 'MY_UPLOADS') {
        if (!user) return !!doc.createdBy;
        return doc.createdBy === user.uid || (!!doc.uploadedByEmail && doc.uploadedByEmail === user.email);
      }
      if (filterType === 'COMPLETED') {
        return isDocumentCompleted(doc);
      }
      if (filterType === 'OVERDUE') {
        return !isDocumentCompleted(doc) && status.type === 'OVERDUE';
      }
      if (filterType === 'DUE_TODAY') {
        return !isDocumentCompleted(doc) && status.type === 'DUE_TODAY';
      }
      if (filterType === 'IN_TIME') {
        return status.type === 'IN_TIME' || status.type === 'DUE_SOON';
      }
      if (filterType === 'STANDING_BOARD') {
        return (doc.proposedAction || '').includes('Ban Thường vụ') || (doc.proposedAction || '').includes('Thường trực') || (doc.proposedAction || '').includes('Bí thư');
      }
      if (filterType === 'URGENT') {
        return !isDocumentCompleted(doc) && doc.urgency && doc.urgency !== 'Thường';
      }
      if (filterType === 'DRIVE') {
        return !!(doc.driveFileId || doc.driveUrl);
      }
      return true;
    });
  }, [documents, debouncedSearch, filterType, selectedTagFilter, selectedDocType, startDate, endDate, dateFieldType, user]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterType !== 'ALL') count++;
    if (selectedDocType !== 'ALL') count++;
    if (selectedTagFilter !== 'ALL') count++;
    if (startDate || endDate) count++;
    if (searchTerm) count++;
    return count;
  }, [filterType, selectedDocType, selectedTagFilter, startDate, endDate, searchTerm]);

  const handleExportCsv = () => {
    const headers = ["Số thứ tự", "Số / Ký hiệu", "Ngày ban hành", "Cơ quan ban hành", "Trích yếu nội dung", "Loại văn bản", "Đề xuất phân luồng", "Đơn vị chủ trì", "Hạn báo cáo", "Kết quả xử lý"];
    const rows = filteredDocs.map((doc, idx) => [
      idx + 1,
      `"${(doc.documentNumber || '').replace(/"/g, '""')}"`,
      `"${formatDateToDMY(doc.issuedDate)}"`,
      `"${(doc.issuer || '').replace(/"/g, '""')}"`,
      `"${(doc.title || doc.fileName || '').replace(/"/g, '""')}"`,
      `"${(doc.documentType || 'Văn bản').replace(/"/g, '""')}"`,
      `"${(doc.proposedAction || '').replace(/"/g, '""')}"`,
      `"${(doc.leadDepartment || '').replace(/"/g, '""')}"`,
      `"${(doc.actionDeadline || '').replace(/"/g, '""')}"`,
      `"${doc.processingResult === 'COMPLETED' ? 'Đã hoàn thành' : 'Đang thực hiện'}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `So_Dang_Ky_Van_Ban_Den_${formatDateToYMD(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const progressCounts = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let inTime = 0;
    let completed = 0;
    let standingBoard = 0;
    let driveCount = 0;
    let importantCount = 0;
    let myUploadsCount = 0;

    for (const d of documents) {
      const procResult = (d.processingResult || '').toUpperCase();
      const isDocCompleted = procResult === 'COMPLETED' || procResult === 'ĐÃ HOÀN THÀNH' || procResult === 'HOÀN THÀNH' || (d.status as string) === 'COMPLETED';
      if (isDocCompleted) completed++;

      const st = getDocumentProgressStatus(d);
      if (st.type === 'OVERDUE') overdue++;
      else if (st.type === 'DUE_TODAY') dueToday++;
      else if (st.type === 'DUE_SOON' || st.type === 'IN_TIME') inTime++;

      const u = (d.urgency || '').toUpperCase();
      const isUrgent = u.includes('HOA_TOC') || u.includes('HỎA TỐC') || u.includes('THUONG_KHAN') || u.includes('THƯỢNG KHẨN') || u.includes('KHẨN');
      const isStanding = (d.proposedAction || '').includes('Ban Thường vụ') || (d.proposedAction || '').includes('Thường trực');
      
      if (d.isImportant || d.isStarred || isUrgent || isStanding) {
        importantCount++;
      }

      if (user && (d.createdBy === user.uid || (d.uploadedByEmail && d.uploadedByEmail === user.email))) {
        myUploadsCount++;
      } else if (!user && d.createdBy) {
        myUploadsCount++;
      }

      if (isStanding || (d.proposedAction || '').includes('Bí thư')) {
        standingBoard++;
      }
      if (d.driveFileId || d.driveUrl) {
        driveCount++;
      }
    }
    return { overdue, dueToday, inTime, completed, standingBoard, driveCount, importantCount, myUploadsCount };
  }, [documents, user]);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs text-slate-500 font-semibold">Đang đồng bộ danh sách văn bản...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans transform-gpu">
      
      {/* Header & Metric Cards Banner with Google Studio Flowing Gradient Border */}
      <div className="space-y-3">
        <div className="google-studio-border google-studio-glow">
          <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 rounded-[calc(1.25rem-2px)] p-4 md:p-5 text-white shadow-lg shadow-blue-500/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-white/20 text-white rounded-xl shadow-xs backdrop-blur-xs border border-white/30">
                  <FileText className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-white/20 text-white rounded-full border border-white/30 backdrop-blur-xs">
                      Sổ Quản Lý Văn Thư Cấp Ủy
                    </span>
                    <span className="text-[10px] text-amber-200 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      Google Studio AI Stream
                    </span>
                  </div>
                  <h1 className="text-base md:text-lg font-black text-white uppercase tracking-wide mt-0.5 drop-shadow-xs">
                    Văn Bản Đến & Trình Bí Thư Đảng Ủy
                  </h1>
                </div>
              </div>

              <Link 
                to="/" 
                className="px-4 py-2 text-xs font-black text-blue-800 bg-white hover:bg-blue-50 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer border border-white/80 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-blue-700" />
                <span>Tiếp nhận văn bản mới</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 4 Compact Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div 
            onClick={() => setFilterType('ALL')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              filterType === 'ALL' 
                ? 'bg-blue-900 text-white border-blue-800 shadow-md ring-2 ring-blue-500/30' 
                : 'bg-white hover:bg-blue-50/50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${filterType === 'ALL' ? 'text-blue-200' : 'text-slate-500'}`}>
                Tổng Tiếp Nhận
              </span>
              <FileText className={`w-4 h-4 ${filterType === 'ALL' ? 'text-amber-300' : 'text-blue-600'}`} />
            </div>
            <div className="text-xl font-black mt-1">{documents.length} <span className="text-xs font-semibold opacity-75">văn bản</span></div>
          </div>

          <div 
            onClick={() => setFilterType('STANDING_BOARD')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              filterType === 'STANDING_BOARD' 
                ? 'bg-blue-900 text-white border-blue-800 shadow-md ring-2 ring-blue-500/30' 
                : 'bg-white hover:bg-blue-50/50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${filterType === 'STANDING_BOARD' ? 'text-blue-200' : 'text-slate-500'}`}>
                Trình Bí Thư / BTV
              </span>
              <ShieldCheck className={`w-4 h-4 ${filterType === 'STANDING_BOARD' ? 'text-amber-300' : 'text-blue-600'}`} />
            </div>
            <div className="text-xl font-black mt-1 text-blue-600 dark:text-blue-400">
              {progressCounts.standingBoard} <span className="text-xs font-semibold opacity-75">văn bản</span>
            </div>
          </div>

          <div 
            onClick={() => setFilterType('OVERDUE')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              filterType === 'OVERDUE' 
                ? 'bg-red-700 text-white border-red-800 shadow-md ring-2 ring-red-500/30' 
                : progressCounts.overdue > 0 ? 'bg-red-50/70 border-red-200 text-red-950 hover:bg-red-100/60' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${filterType === 'OVERDUE' ? 'text-red-100' : 'text-red-700'}`}>
                Cần Gấp / Quá Hạn
              </span>
              <AlertTriangle className={`w-4 h-4 ${filterType === 'OVERDUE' ? 'text-white' : 'text-red-600 animate-pulse'}`} />
            </div>
            <div className="text-xl font-black mt-1 text-red-700">
              {progressCounts.overdue} <span className="text-xs font-semibold opacity-75">văn bản</span>
            </div>
          </div>

          <div 
            onClick={() => setFilterType('DUE_TODAY')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              filterType === 'DUE_TODAY' 
                ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-500/30' 
                : 'bg-white hover:bg-amber-50/50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${filterType === 'DUE_TODAY' ? 'text-amber-100' : 'text-slate-500'}`}>
                Hôm Nay & Trong Hạn
              </span>
              <Clock className={`w-4 h-4 ${filterType === 'DUE_TODAY' ? 'text-white' : 'text-amber-600'}`} />
            </div>
            <div className="text-xl font-black mt-1 text-emerald-700">
              {progressCounts.dueToday + progressCounts.inTime} <span className="text-xs font-semibold opacity-75">văn bản</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Filter & Search Control Panel */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3.5">
        
        {/* Top Row: Search & Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Input Bar */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo số ký hiệu, trích yếu, cơ quan ban hành, từ khóa nội dung..."
              className="w-full pl-9 pr-8 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 font-semibold placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Tools: Sổ đăng ký & Xuất CSV */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                showAdvancedFilters || startDate || endDate || selectedDocType !== 'ALL'
                  ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Bộ lọc thời gian & loại ({activeFiltersCount})</span>
              {showAdvancedFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              onClick={() => setShowIncomingRegisterModal(true)}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Xem Sổ Đăng Ký Văn Bản Đến (Quy chuẩn Hành chính)"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sổ Văn bản đến</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={filteredDocs.length === 0}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Xuất bảng dữ liệu ra file CSV/Excel"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Xuất CSV ({filteredDocs.length})</span>
            </button>
          </div>
        </div>

        {/* Status Filter Segmented Controls */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold pt-1">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({documents.length})
          </button>

          <button
            onClick={() => setFilterType('IMPORTANT')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'IMPORTANT'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${filterType === 'IMPORTANT' ? 'fill-white text-white' : 'fill-amber-500 text-amber-500'}`} />
            <span>Quan trọng ({progressCounts.importantCount})</span>
          </button>

          <button
            onClick={() => setFilterType('MY_UPLOADS')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'MY_UPLOADS'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Tôi tải lên ({progressCounts.myUploadsCount})</span>
          </button>

          <button
            onClick={() => setFilterType('STANDING_BOARD')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'STANDING_BOARD'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Trình BTV ({progressCounts.standingBoard})</span>
          </button>

          {progressCounts.overdue > 0 && (
            <button
              onClick={() => setFilterType('OVERDUE')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'OVERDUE'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span>Trễ hạn ({progressCounts.overdue})</span>
            </button>
          )}

          <button
            onClick={() => setFilterType('DUE_TODAY')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'DUE_TODAY'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Hôm nay ({progressCounts.dueToday})</span>
          </button>

          <button
            onClick={() => setFilterType('COMPLETED')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'COMPLETED'
                ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Đã xong ({progressCounts.completed})</span>
          </button>

          <button
            onClick={() => setFilterType('IN_TIME')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'IN_TIME'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Trong hạn ({progressCounts.inTime})</span>
          </button>

          <button
            onClick={() => setFilterType('DRIVE')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterType === 'DRIVE'
                ? 'bg-blue-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            <span>Drive ({progressCounts.driveCount})</span>
          </button>
        </div>

        {/* Collapsible Advanced Filters Section: Date Range & Doc Types */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 bg-slate-50/70 p-3.5 rounded-xl space-y-3">
            
            {/* Quick Date Range Presets */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> Mốc thời gian nhanh:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'Tất cả thời gian' },
                  { id: 'TODAY', label: 'Hôm nay' },
                  { id: '7_DAYS', label: '7 ngày qua' },
                  { id: '30_DAYS', label: '30 ngày qua' },
                  { id: 'THIS_MONTH', label: 'Tháng này' },
                  { id: 'THIS_QUARTER', label: 'Quý này' },
                  { id: 'THIS_YEAR', label: 'Cả năm nay' }
                ].map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyDatePreset(preset.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      activeDatePreset === preset.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Inputs & Target Date Type Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Áp dụng mốc ngày cho:
                </label>
                <select
                  value={dateFieldType}
                  onChange={(e) => setDateFieldType(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Tất cả ngày (Ban hành / Nạp / Hạn)</option>
                  <option value="ISSUED_DATE">Chỉ Ngày ban hành văn bản</option>
                  <option value="RECEIVED_OR_CREATED">Chỉ Ngày tiếp nhận / Nạp hệ thống</option>
                  <option value="DEADLINE">Chỉ Hạn chót xử lý / Báo cáo</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Từ ngày:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActiveDatePreset('CUSTOM');
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Đến ngày:
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActiveDatePreset('CUSTOM');
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Document Type Filter */}
            <div className="pt-2 border-t border-slate-200/60">
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> Phân loại văn bản chuẩn hành chính:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ADMINISTRATIVE_DOC_TYPES.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedDocType(opt.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      selectedDocType === opt.value
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : `${opt.colorClass} hover:opacity-80`
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Bottom Row: Topic / Tag Droplist Filter & Active Filters Clear */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-1 max-w-sm">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 whitespace-nowrap">
              <Filter className="w-3.5 h-3.5 text-blue-600" /> Chủ đề / Nghiệp vụ:
            </span>
            <select
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">-- Tất cả chủ đề ({documents.length}) --</option>
              {STANDARD_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-semibold">
              Đang hiển thị: <strong className="text-blue-900">{filteredDocs.length}</strong> / {documents.length} văn bản
            </span>
            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-red-200"
              >
                <X className="w-3 h-3" />
                <span>Đặt lại tất cả bộ lọc</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Clean Modern Table Container */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/90">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider w-36">Số / Ký hiệu</th>
                <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Trích yếu nội dung & Cơ quan gửi</th>
                <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider w-40">Đề xuất Tham mưu</th>
                <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider w-56">Phó Chánh VP & Kết quả xử lý</th>
                <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider w-32">Tiến độ hạn chót</th>
                <th className="px-5 py-3 text-right text-[11px] font-black text-slate-500 uppercase tracking-wider w-36">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-xs">
              {filteredDocs.map((doc) => {
                const driveLink = doc.driveUrl || (doc.driveFileId ? `https://drive.google.com/file/d/${doc.driveFileId}/view` : null);
                const progress = getDocumentProgressStatus(doc);

                return (
                  <tr key={doc.id} className="hover:bg-blue-50/40 transition-colors group">
                    
                    {/* Số / Ký hiệu & Đánh dấu sao */}
                    <td className="px-5 py-3.5 whitespace-nowrap align-top">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleToggleStar(e, doc)}
                          disabled={starTogglingId === doc.id}
                          className="p-1 rounded-md hover:bg-amber-100 text-slate-300 hover:text-amber-500 transition-colors cursor-pointer"
                          title={(doc.isImportant || doc.isStarred) ? "Bỏ đánh dấu quan trọng" : "Đánh dấu quan trọng"}
                        >
                          <Star className={`w-3.5 h-3.5 ${(doc.isImportant || doc.isStarred) ? 'fill-amber-500 text-amber-500' : ''}`} />
                        </button>
                        <div className="font-extrabold text-blue-950 text-xs">{doc.documentNumber || 'Đang cập nhật'}</div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5 ml-5">{doc.issuedDate || 'Ngày: N/A'}</div>
                      <div className="flex flex-wrap items-center gap-1 mt-1 ml-5">
                        {(doc.isImportant || doc.isStarred) && (
                          <span className="inline-block px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-black rounded border border-amber-200">
                            ⭐ Quan trọng
                          </span>
                        )}
                        {doc.urgency && doc.urgency !== 'Thường' && (
                          <span className="inline-block px-1.5 py-0.2 bg-red-100 text-red-800 text-[9px] font-black rounded border border-red-200">
                            {doc.urgency}
                          </span>
                        )}
                        {driveLink && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded">
                            <HardDrive className="w-2.5 h-2.5" />
                            Drive
                          </span>
                        )}
                        {doc.uploadedByName && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-medium rounded">
                            <User className="w-2 h-2" />
                            {doc.uploadedByName}
                          </span>
                        )}
                        {doc.wardName && activeWardId === 'all' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-bold rounded">
                            <Building2 className="w-2 h-2" />
                            {doc.wardName.replace('Đảng ủy ', '')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Trích yếu & Cơ quan gửi */}
                    <td className="px-5 py-3.5 align-top max-w-sm">
                      <Link 
                        to={`/documents/${doc.id}`} 
                        className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 text-xs leading-snug"
                      >
                        {doc.title || doc.fileName}
                      </Link>
                      <div className="text-[11px] text-slate-500 font-medium mt-1">
                        Cơ quan gửi: <strong className="text-slate-700">{doc.issuer || 'Chưa rõ'}</strong>
                      </div>

                      {/* Document Tags */}
                      {(() => {
                        const tags = getDocumentTags(doc);
                        if (tags.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {tags.slice(0, 3).map((t) => {
                              const style = getTagStyle(t);
                              return (
                                <span
                                  key={t}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTagFilter(t);
                                  }}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-transform hover:scale-105 cursor-pointer ${style.bgClass}`}
                                  title={`Lọc theo chủ đề: ${t}`}
                                >
                                  <span>{style.icon}</span>
                                  <span>{t}</span>
                                </span>
                              );
                            })}
                            {tags.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-bold">
                                +{tags.length - 3}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Đề xuất Tham mưu */}
                    <td className="px-5 py-3.5 align-top">
                      {doc.proposedAction ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200/80 leading-snug">
                          {doc.proposedAction}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Chưa phân luồng</span>
                      )}
                    </td>

                    {/* Phó Chánh VP & Kết quả xử lý */}
                    <td className="px-5 py-3.5 align-top space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Giao Phó Chánh VP:</label>
                        <select
                          value={doc.assignedDeputyChief || ''}
                          onChange={(e) => handleUpdateDeputyChief(doc.id, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        >
                          <option value="">-- Chọn Phó Chánh VP --</option>
                          {deputyChiefs.map((deputy, idx) => (
                            <option key={idx} value={deputy}>{deputy}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Kết quả xử lý:</label>
                        <select
                          value={doc.processingResult || 'IN_PROGRESS'}
                          onChange={(e) => handleUpdateProcessingResult(doc.id, e.target.value)}
                          className={`w-full border rounded-xl px-2 py-1 text-xs font-bold focus:outline-none ${
                            doc.processingResult === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : doc.processingResult === 'OVERDUE'
                              ? 'bg-red-50 text-red-800 border-red-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          <option value="IN_PROGRESS">⏳ Đang thực hiện</option>
                          <option value="COMPLETED">✅ Đã hoàn thành</option>
                          <option value="PENDING">⏱️ Chờ xử lý / Chưa giao</option>
                          <option value="OVERDUE">⚠️ Trễ hạn / Cần đôn đốc</option>
                        </select>
                      </div>
                    </td>

                    {/* Tiến độ hạn chót */}
                    <td className="px-5 py-3.5 whitespace-nowrap align-top">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border ${progress.badgeClass}`}>
                          {progress.label}
                        </span>
                        {doc.actionDeadline && (
                          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Hạn: <strong className="text-slate-700">{doc.actionDeadline}</strong></span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Bút phê & Thao tác */}
                    <td className="px-5 py-3.5 whitespace-nowrap align-top text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Dispatch Slip / Bút phê button */}
                        <button
                          onClick={() => setSelectedSlipDoc(doc)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Bút phê & In Phiếu Trình Bí thư Đảng ủy"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Bút phê</span>
                        </button>

                        {/* Document Details Link */}
                        <Link 
                          to={`/documents/${doc.id}`} 
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-100/60 rounded-lg transition-colors"
                          title="Xem thông tin chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        {/* Drive Direct Link */}
                        {driveLink && (
                          <a
                            href={driveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Mở tài liệu Google Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-600">Không tìm thấy văn bản phù hợp</p>
                      <p className="text-[11px]">Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc phía trên.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Slip Modal */}
      {selectedSlipDoc && (
        <DispatchSlip document={selectedSlipDoc} onClose={() => setSelectedSlipDoc(null)} />
      )}

      {/* Sổ Đăng Ký Văn Bản Đến Modal (Quy chuẩn Hành chính) */}
      {showIncomingRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <BookOpen className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">
                    Sổ Đăng Ký Văn Bản Đến - Văn Phòng Đảng Ủy
                  </h3>
                  <p className="text-xs text-blue-200">
                    Quy chuẩn quản lý văn thư & lưu trữ hồ sơ hành chính Đảng
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>In Sổ</span>
                </button>
                <button
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất CSV</span>
                </button>
                <button
                  onClick={() => setShowIncomingRegisterModal(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content / Printable Table */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="text-center space-y-1 pb-3 border-b border-slate-200">
                <div className="text-xs uppercase font-extrabold text-slate-500">
                  {activeWard?.parentOrg ? activeWard.parentOrg.toUpperCase() : 'THÀNH ỦY THỦ DẦU MỘT'} - {activeWard?.name ? activeWard.name.toUpperCase() : 'ĐẢNG ỦY PHƯỜNG PHÚ CƯỜNG'}
                </div>
                <div className="text-base font-black uppercase text-blue-950">SỔ ĐĂNG KÝ VĂN BẢN ĐẾN</div>
                <div className="text-xs text-slate-500 italic">
                  Tổng số mục trong danh sách: <strong>{filteredDocs.length}</strong> văn bản
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded-xl">
                <table className="min-w-full divide-y divide-slate-300 text-xs font-sans">
                  <thead className="bg-slate-100 font-bold text-slate-800 text-center">
                    <tr>
                      <th className="px-3 py-2.5 border-r border-slate-300 w-12">Số đến</th>
                      <th className="px-3 py-2.5 border-r border-slate-300 w-24">Ngày đến</th>
                      <th className="px-3 py-2.5 border-r border-slate-300 w-36">Tác giả / CQ ban hành</th>
                      <th className="px-3 py-2.5 border-r border-slate-300 w-32">Số, ký hiệu</th>
                      <th className="px-3 py-2.5 border-r border-slate-300 w-24">Ngày tháng VB</th>
                      <th className="px-4 py-2.5 border-r border-slate-300 text-left">Tên loại và trích yếu nội dung</th>
                      <th className="px-3 py-2.5 border-r border-slate-300 w-36">Người nhận / Chủ trì</th>
                      <th className="px-3 py-2.5 w-28">Hạn giải quyết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
                    {filteredDocs.map((doc, idx) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-center font-bold text-slate-900 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap">
                          {formatDateToDMY(doc.receivedDate || (doc.createdAt as any)) || 'N/A'}
                        </td>
                        <td className="px-3 py-2 font-medium border-r border-slate-200">
                          {doc.issuer || 'Chưa rõ'}
                        </td>
                        <td className="px-3 py-2 font-bold text-blue-900 border-r border-slate-200 whitespace-nowrap">
                          {doc.documentNumber || 'Đang cập nhật'}
                        </td>
                        <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap">
                          {formatDateToDMY(doc.issuedDate) || 'N/A'}
                        </td>
                        <td className="px-4 py-2 border-r border-slate-200 font-medium leading-relaxed">
                          <span className="font-bold text-slate-900">[{doc.documentType || 'Văn bản'}] </span>
                          {doc.title || doc.fileName}
                        </td>
                        <td className="px-3 py-2 border-r border-slate-200 text-xs">
                          {doc.assignedDeputyChief ? (
                            <span className="font-bold text-slate-800">{doc.assignedDeputyChief}</span>
                          ) : doc.leadDepartment ? (
                            <span>{doc.leadDepartment}</span>
                          ) : (
                            <span className="text-slate-400 italic">Văn phòng</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {doc.actionDeadline ? (
                            <span className="font-bold text-red-700">{formatDateToDMY(doc.actionDeadline)}</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Theo quy chế</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredDocs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                          Không có văn bản nào trong danh sách được chọn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                Văn phòng Đảng ủy • Trợ lý Tham mưu & Xử lý Văn bản
              </div>
              <button
                onClick={() => setShowIncomingRegisterModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
