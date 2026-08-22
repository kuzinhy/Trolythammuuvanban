import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Document } from '../types';
import { 
  Eye, Loader2, Search, Plus, Printer, ShieldAlert, 
  HardDrive, ExternalLink, Clock, AlertTriangle, CheckCircle2, Calendar, Tag,
  FileText, Check, X, ShieldCheck, Filter
} from 'lucide-react';
import { Link } from 'react-router';
import DispatchSlip from '../components/DispatchSlip';
import { getDocumentTags, getTagStyle, STANDARD_TAGS } from '../lib/tagUtils';
import { getDocumentProgressStatus } from '../lib/documentUtils';
export { getDocumentProgressStatus };

export type ProgressFilter = 'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'IN_TIME' | 'STANDING_BOARD' | 'URGENT' | 'DRIVE';

export function parseDateString(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const str = dateStr.trim();
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    return new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
  }
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}



export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<ProgressFilter>('ALL');
  const [selectedSlipDoc, setSelectedSlipDoc] = useState<Document | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');

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
      const docTags = getDocumentTags(doc);

      if (selectedTagFilter !== 'ALL') {
        if (!docTags.includes(selectedTagFilter)) return false;
      }

      if (term) {
        const matchesSearch = 
          (doc.documentNumber || '').toLowerCase().includes(term) ||
          (doc.title || doc.fileName || '').toLowerCase().includes(term) ||
          (doc.issuer || '').toLowerCase().includes(term) ||
          (doc.leadDepartment || '').toLowerCase().includes(term) ||
          (doc.proposedAction || '').toLowerCase().includes(term) ||
          (doc.actionDeadline || '').toLowerCase().includes(term) ||
          docTags.some(t => t.toLowerCase().includes(term));

        if (!matchesSearch) return false;
      }

      const status = getDocumentProgressStatus(doc);

      if (filterType === 'OVERDUE') {
        return status.type === 'OVERDUE';
      }
      if (filterType === 'DUE_TODAY') {
        return status.type === 'DUE_TODAY';
      }
      if (filterType === 'IN_TIME') {
        return status.type === 'IN_TIME' || status.type === 'DUE_SOON';
      }
      if (filterType === 'STANDING_BOARD') {
        return (doc.proposedAction || '').includes('Ban Thường vụ') || (doc.proposedAction || '').includes('Thường trực') || (doc.proposedAction || '').includes('Bí thư');
      }
      if (filterType === 'URGENT') {
        return doc.urgency && doc.urgency !== 'Thường';
      }
      if (filterType === 'DRIVE') {
        return !!(doc.driveFileId || doc.driveUrl);
      }
      return true;
    });
  }, [documents, debouncedSearch, filterType, selectedTagFilter]);

  const progressCounts = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let inTime = 0;
    let standingBoard = 0;
    let driveCount = 0;

    for (const d of documents) {
      const st = getDocumentProgressStatus(d);
      if (st.type === 'OVERDUE') overdue++;
      else if (st.type === 'DUE_TODAY') dueToday++;
      else if (st.type === 'DUE_SOON' || st.type === 'IN_TIME') inTime++;

      if ((d.proposedAction || '').includes('Ban Thường vụ') || (d.proposedAction || '').includes('Thường trực') || (d.proposedAction || '').includes('Bí thư')) {
        standingBoard++;
      }
      if (d.driveFileId || d.driveUrl) {
        driveCount++;
      }
    }
    return { overdue, dueToday, inTime, standingBoard, driveCount };
  }, [documents]);

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
      
      {/* Header & Metric Cards Banner */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <FileText className="w-5 h-5" />
              </span>
              <h1 className="text-lg font-black text-blue-950 uppercase tracking-wide">
                Văn Bản Đến & Trình Bí Thư Đảng Ủy
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Sổ tiếp nhận, tham mưu phân luồng & xem xét bút phê chỉ đạo cấp ủy
            </p>
          </div>

          <Link 
            to="/" 
            className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tiếp nhận văn bản mới</span>
          </Link>
        </div>

        {/* 4 Compact Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-3">
        
        {/* Top Row: Search & Status Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Input Bar */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo số ký hiệu, trích yếu, cơ quan ban hành..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 font-semibold placeholder:text-slate-400"
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

          {/* Status Filter Segmented Controls */}
          <div className="flex flex-wrap items-center gap-1 text-xs font-bold">
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
              onClick={() => setFilterType('IN_TIME')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'IN_TIME'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
        </div>

        {/* Bottom Row: Topic / Tag Droplist Filter */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-1 max-w-xs">
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

          {selectedTagFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedTagFilter('ALL')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 cursor-pointer"
            >
              Đặt lại bộ lọc chủ đề
            </button>
          )}
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
                    
                    {/* Số / Ký hiệu */}
                    <td className="px-5 py-3.5 whitespace-nowrap align-top">
                      <div className="font-extrabold text-blue-950 text-xs">{doc.documentNumber || 'Đang cập nhật'}</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">{doc.issuedDate || 'Ngày: N/A'}</div>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
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
    </div>
  );
}
