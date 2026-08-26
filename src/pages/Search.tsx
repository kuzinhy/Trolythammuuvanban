import { useState, useRef, useCallback, useEffect, useMemo, type FormEvent } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Search as SearchIcon, Loader2, FileText, ChevronRight, HardDrive, 
  Sparkles, Filter, ExternalLink, Printer, ShieldAlert, BookOpen, CheckCircle2, Tag,
  FolderOpen, Layers, Star, User, Calendar, Clock, RotateCcw, X, Check, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { Document } from '../types';
import { safeFetchJson } from '../lib/safeFetch';
import DispatchSlip from '../components/DispatchSlip';
import { getDocumentTags, getTagStyle, STANDARD_TAGS } from '../lib/tagUtils';
import { 
  ADMINISTRATIVE_DOC_TYPES, 
  matchDocumentType, 
  matchDocumentDateRange, 
  formatDateToYMD, 
  formatDateToDMY 
} from '../lib/documentUtils';
import SearchKnowledgeUploadZone from '../components/SearchKnowledgeUploadZone';

interface AISearchResult {
  aiAnswerSummary: string;
  matchedDocIndexes: Array<{
    index: number;
    matchReason: string;
    relevanceScore: number;
  }>;
}

export default function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState<'FULL_TEXT' | 'AI_SEMANTIC'>('FULL_TEXT');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Document[]>([]);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AISearchResult | null>(null);
  const [docMatchReasons, setDocMatchReasons] = useState<Record<string, string>>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSlipDoc, setSelectedSlipDoc] = useState<Document | null>(null);

  // Advanced Filter States: Document Type & Authority
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterAuthority, setFilterAuthority] = useState<string>('ALL');
  const [filterDriveOnly, setFilterDriveOnly] = useState<boolean>(false);
  const [filterReferenceOnly, setFilterReferenceOnly] = useState<boolean>(false);

  // Date Range Filter States
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterDateFieldType, setFilterDateFieldType] = useState<'ALL' | 'ISSUED_DATE' | 'RECEIVED_OR_CREATED' | 'DEADLINE'>('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(true);

  const [poolDocs, setPoolDocs] = useState<Document[]>([]);
  const cachedDocsRef = useRef<Document[] | null>(null);
  const navigate = useNavigate();

  // Load candidate documents pool on mount into ref cache & state
  useEffect(() => {
    const fetchPool = async () => {
      try {
        const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(300));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
        cachedDocsRef.current = docs;
        setPoolDocs(docs);
      } catch (e) {
        console.error("Error caching documents for search:", e);
      }
    };
    fetchPool();
  }, []);

  const referenceDocsCount = useMemo(() => {
    return poolDocs.filter(d => 
      d.isReferenceDoc || 
      (d.tags || []).includes('TRA_CUU_THAM_KHAO') || 
      (d.tags || []).includes('Văn bản tra cứu') ||
      !!d.referenceCategory
    ).length;
  }, [poolDocs]);

  const handleDocumentAdded = useCallback((newDoc: Document) => {
    setPoolDocs(prev => [newDoc, ...prev]);
    if (cachedDocsRef.current) {
      cachedDocsRef.current = [newDoc, ...cachedDocsRef.current];
    }
    setResults(prev => [newDoc, ...prev]);
    setHasSearched(true);
  }, []);

  // Quick Date Preset Handler
  const handleApplyDatePreset = (preset: 'today' | '7days' | '30days' | 'thisMonth' | 'thisQuarter' | 'thisYear' | 'clear') => {
    const now = new Date();
    const todayStr = formatDateToYMD(now);

    if (preset === 'clear') {
      setFilterStartDate('');
      setFilterEndDate('');
      return;
    }

    if (preset === 'today') {
      setFilterStartDate(todayStr);
      setFilterEndDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setFilterStartDate(formatDateToYMD(past));
      setFilterEndDate(todayStr);
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setFilterStartDate(formatDateToYMD(past));
      setFilterEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setFilterStartDate(formatDateToYMD(startOfMonth));
      setFilterEndDate(todayStr);
    } else if (preset === 'thisQuarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
      setFilterStartDate(formatDateToYMD(startOfQuarter));
      setFilterEndDate(todayStr);
    } else if (preset === 'thisYear') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      setFilterStartDate(formatDateToYMD(startOfYear));
      setFilterEndDate(formatDateToYMD(endOfYear));
    }
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    setFilterType('ALL');
    setFilterAuthority('ALL');
    setFilterDriveOnly(false);
    setFilterReferenceOnly(false);
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterDateFieldType('ALL');
  };

  const isAnyFilterActive = useMemo(() => {
    return (
      filterType !== 'ALL' ||
      filterAuthority !== 'ALL' ||
      filterDriveOnly ||
      filterReferenceOnly ||
      !!filterStartDate ||
      !!filterEndDate ||
      filterDateFieldType !== 'ALL'
    );
  }, [filterType, filterAuthority, filterDriveOnly, filterReferenceOnly, filterStartDate, filterEndDate, filterDateFieldType]);

  const performKeywordFilter = useCallback((docs: Document[], rawTerm: string) => {
    const term = rawTerm.toLowerCase().trim();
    if (!term) return docs;

    return docs.filter((data) => {
      const matchNumber = (data.documentNumber || '').toLowerCase().includes(term);
      const matchTitle = (data.title || '').toLowerCase().includes(term);
      const matchFileName = (data.fileName || '').toLowerCase().includes(term);
      const matchSummary = (data.summary || '').toLowerCase().includes(term);
      const matchFullContent = (data.fullContent || '').toLowerCase().includes(term);
      const matchProposed = (data.proposedAction || '').toLowerCase().includes(term);
      const matchLead = (data.leadDepartment || '').toLowerCase().includes(term);
      const matchIssuer = (data.issuer || '').toLowerCase().includes(term);
      const matchKeywords = (data.extractedTextKeywords || []).some(k => k.toLowerCase().includes(term));
      const matchDirectives = (data.keyDirectives || []).some(kd => kd.toLowerCase().includes(term));
      const matchLegalBasis = (data.legalBasis || []).some(lb => lb.toLowerCase().includes(term));
      const matchOrgs = (data.organizations || []).some(org => org.toLowerCase().includes(term));
      const matchPersons = (data.persons || []).some(person => person.toLowerCase().includes(term));
      const matchTags = (data.tags || []).some(t => t.toLowerCase().includes(term));

      return (
        matchNumber || matchTitle || matchFileName || matchSummary || matchFullContent ||
        matchProposed || matchLead || matchIssuer || matchKeywords || matchDirectives ||
        matchLegalBasis || matchOrgs || matchPersons || matchTags
      );
    });
  }, []);

  const handleSearch = async (e?: FormEvent, customTerm?: string) => {
    if (e) e.preventDefault();
    const queryTerm = (customTerm !== undefined ? customTerm : searchTerm).trim();
    
    // If no search term but filters are active, we search all pool docs
    if (!queryTerm && !isAnyFilterActive) return;

    setIsSearching(true);
    setHasSearched(true);
    setAiAnalysisResult(null);
    setDocMatchReasons({});

    try {
      let pool = cachedDocsRef.current;
      if (!pool) {
        const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(300));
        const snapshot = await getDocs(q);
        pool = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
        cachedDocsRef.current = pool;
      }

      if (searchMode === 'FULL_TEXT' || !queryTerm) {
        const filtered = queryTerm ? performKeywordFilter(pool, queryTerm) : pool;
        setResults(filtered);
      } else {
        // AI Semantic Deep Inquiry Mode
        const res = await safeFetchJson<AISearchResult>('/api/search-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: queryTerm,
            documents: pool
          })
        });

        if (!res.ok || !res.data) throw new Error(res.error || "Tra cứu AI thất bại");
        const aiData: AISearchResult = res.data;
        setAiAnalysisResult(aiData);

        const matchedDocs: Document[] = [];
        const reasonsMap: Record<string, string> = {};

        if (aiData.matchedDocIndexes) {
          aiData.matchedDocIndexes.forEach(item => {
            const matchedDoc = pool![item.index];
            if (matchedDoc) {
              matchedDocs.push(matchedDoc);
              reasonsMap[matchedDoc.id] = item.matchReason;
            }
          });
        }

        setResults(matchedDocs);
        setDocMatchReasons(reasonsMap);
      }
    } catch (error) {
      console.error("Search error:", error);
      // Fallback to keyword search on error
      if (cachedDocsRef.current) {
        setResults(performKeywordFilter(cachedDocsRef.current, queryTerm));
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleChipClick = (chip: string) => {
    setSearchTerm(chip);
    handleSearch(undefined, chip);
  };

  // Determine base documents to filter:
  // If user searched, use `results`; if user hasn't searched with query but has filters active, use `poolDocs`.
  const baseDocsForFiltering = useMemo(() => {
    if (hasSearched) return results;
    if (isAnyFilterActive) return poolDocs;
    return [];
  }, [hasSearched, results, isAnyFilterActive, poolDocs]);

  // Apply Secondary Filters (Date Range, Document Type, Authority, Drive, Reference)
  const displayResults = useMemo(() => {
    if (!hasSearched && !isAnyFilterActive) return [];

    return baseDocsForFiltering.filter(doc => {
      // 1. Google Drive Only
      if (filterDriveOnly && !doc.driveFileId && !doc.driveUrl) return false;

      // 2. Reference / Knowledge Library Only
      if (filterReferenceOnly) {
        const isRef = doc.isReferenceDoc || (doc.tags || []).includes('TRA_CUU_THAM_KHAO') || (doc.tags || []).includes('Văn bản tra cứu') || !!doc.referenceCategory;
        if (!isRef) return false;
      }

      // 3. Authority Filter
      if (filterAuthority === 'STANDING_BOARD') {
        if (!doc.proposedAction?.includes('Ban Thường vụ') && !doc.proposedAction?.includes('Thường trực')) return false;
      } else if (filterAuthority === 'UBND') {
        if (!doc.proposedAction?.includes('UBND')) return false;
      }

      // 4. Document Type Filter (Enhanced with 13 Administrative Types)
      if (filterType !== 'ALL') {
        if (!matchDocumentType(doc, filterType)) return false;
      }

      // 5. Date Range Filter (Từ ngày ... Đến ngày ...)
      if (filterStartDate || filterEndDate) {
        if (!matchDocumentDateRange(doc, filterStartDate, filterEndDate, filterDateFieldType)) {
          return false;
        }
      }

      return true;
    });
  }, [baseDocsForFiltering, hasSearched, isAnyFilterActive, filterDriveOnly, filterReferenceOnly, filterAuthority, filterType, filterStartDate, filterEndDate, filterDateFieldType]);

  const recentReferenceDocs = useMemo(() => {
    return poolDocs.filter(d => 
      d.isReferenceDoc || 
      (d.tags || []).includes('TRA_CUU_THAM_KHAO') || 
      (d.tags || []).includes('Văn bản tra cứu') ||
      !!d.referenceCategory
    ).slice(0, 6);
  }, [poolDocs]);

  // Active Document Type Name Helper
  const currentDocTypeLabel = useMemo(() => {
    return ADMINISTRATIVE_DOC_TYPES.find(t => t.value === filterType)?.label || 'Tất cả loại văn bản';
  }, [filterType]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans transform-gpu pb-12">
      {/* Header with Google Studio Flowing Gradient Border */}
      <div className="google-studio-border google-studio-glow">
        <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 rounded-[calc(1.25rem-2px)] p-4 md:p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-blue-500/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                Tra Cứu Dữ Liệu Lớn
              </span>
              <span className="text-[10px] text-cyan-200 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Google Studio Vector Semantic Search
              </span>
            </div>
            <h1 className="text-base md:text-lg font-black text-white uppercase tracking-wide drop-shadow-xs">
              Tra Cứu & Tìm Kiếm Toàn Văn Văn Bản Cấp Ủy
            </h1>
            <p className="text-xs text-blue-50 mt-0.5 max-w-2xl font-medium">
              Tìm kiếm theo nội dung chi tiết trong tệp Google Drive, số hiệu, căn cứ pháp lý, tài liệu tra cứu hoặc truy vấn bằng câu hỏi tự nhiên.
            </p>
          </div>

          {/* Toggle Mode */}
          <div className="bg-black/20 p-1 rounded-xl flex text-xs font-bold border border-white/20 flex-shrink-0 backdrop-blur-xs">
            <button
              onClick={() => setSearchMode('FULL_TEXT')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                searchMode === 'FULL_TEXT' 
                  ? 'bg-white text-blue-900 shadow-xs font-black' 
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Toàn văn & Từ khóa</span>
            </button>
            <button
              onClick={() => setSearchMode('AI_SEMANTIC')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                searchMode === 'AI_SEMANTIC' 
                  ? 'bg-white text-blue-900 shadow-xs font-black' 
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>Hỏi đáp AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Upload Zone: Dedicated Reference / Knowledge Base Documents Section */}
      <SearchKnowledgeUploadZone 
        onDocumentAdded={handleDocumentAdded}
        referenceDocsCount={referenceDocsCount}
      />

      {/* Search & Filter Box */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 p-5 md:p-7 space-y-5">
        <form onSubmit={(e) => handleSearch(e)} className="max-w-3xl mx-auto space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                searchMode === 'FULL_TEXT'
                  ? "Nhập số hiệu, từ khóa trong tệp, tên dự án, căn cứ pháp lý, tài liệu tra cứu, Google Drive..."
                  : "Hỏi AI: 'Các văn bản quy định về hạn chót báo cáo quy hoạch tháng 8', 'Nghị quyết về nhân sự'..."
              }
              className="w-full pl-11 pr-32 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            <button 
              type="submit" 
              disabled={isSearching || (!searchTerm.trim() && !isAnyFilterActive)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs disabled:opacity-50 transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lọc...</span>
                </>
              ) : (
                <>
                  {searchMode === 'AI_SEMANTIC' && <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                  <span>{searchMode === 'AI_SEMANTIC' ? 'Hỏi AI' : 'Tra cứu'}</span>
                </>
              )}
            </button>
          </div>

          {/* Prompt suggestions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Gợi ý:</span>
              {(searchMode === 'FULL_TEXT' 
                ? ['Tài liệu tra cứu', 'Ban Thường vụ', 'UBND', 'Căn cứ pháp lý', 'Hỏa tốc', 'Sở Tư pháp', 'Google Drive']
                : ['Văn bản thuộc thẩm quyền Ban Thường vụ', 'Các tài liệu quy phạm pháp luật đã nạp', 'Chỉ đạo về đầu tư công', 'Văn bản có hạn trong tháng']
              ).map((chip) => (
                <button
                  type="button"
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{showAdvancedFilters ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc chi tiết'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </form>

        {/* ===================================================================== */}
        {/* COMPREHENSIVE FILTER PANEL: DATE RANGE + DOC TYPE + AUTHORITY */}
        {/* ===================================================================== */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            
            {/* ROW 1: TIME RANGE FILTER (TỪ NGÀY... ĐẾN NGÀY...) */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Bộ Lọc Theo Thời Gian (Từ ngày ... Đến ngày)
                  </span>
                </div>

                {/* Quick Date Presets */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400 font-semibold mr-0.5">Chọn nhanh:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyDatePreset('7days')}
                    className="px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-md font-semibold transition-colors cursor-pointer"
                  >
                    7 ngày qua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDatePreset('30days')}
                    className="px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-md font-semibold transition-colors cursor-pointer"
                  >
                    30 ngày qua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDatePreset('thisMonth')}
                    className="px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-md font-semibold transition-colors cursor-pointer"
                  >
                    Tháng này
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDatePreset('thisQuarter')}
                    className="px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-md font-semibold transition-colors cursor-pointer"
                  >
                    Quý này
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDatePreset('thisYear')}
                    className="px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-md font-semibold transition-colors cursor-pointer"
                  >
                    Năm 2026
                  </button>
                  {(filterStartDate || filterEndDate) && (
                    <button
                      type="button"
                      onClick={() => handleApplyDatePreset('clear')}
                      className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Xóa ngày</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Date Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Start Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <span>Từ ngày:</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* End Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <span>Đến ngày:</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* Date Criterion Field */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Áp dụng cho mốc ngày:</span>
                  </label>
                  <select
                    value={filterDateFieldType}
                    onChange={(e) => setFilterDateFieldType(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="ALL">Tất cả mốc ngày (Ban hành, Nhận, Hạn)</option>
                    <option value="ISSUED_DATE">Ngày ban hành / Ngày ký</option>
                    <option value="RECEIVED_OR_CREATED">Ngày tiếp nhận / Nạp hệ thống</option>
                    <option value="DEADLINE">Hạn chót xử lý / Báo cáo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ROW 2: DOCUMENT TYPE & AUTHORITY & DRIVE FILTERS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Document Type Dropdown */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Loại văn bản:</span>
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  {ADMINISTRATIVE_DOC_TYPES.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Authority Dropdown */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>Thẩm quyền giải quyết:</span>
                </label>
                <select
                  value={filterAuthority}
                  onChange={(e) => setFilterAuthority(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả thẩm quyền</option>
                  <option value="STANDING_BOARD">Trình Ban Thường vụ / Thường trực Cấp ủy</option>
                  <option value="UBND">Ủy ban Nhân dân / Ban Cán sự</option>
                </select>
              </div>

              {/* Source & Collection Filters */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nguồn lưu trữ & Chuyên mục:</span>
                </label>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setFilterReferenceOnly(!filterReferenceOnly)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      filterReferenceOnly
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Kho Tra Cứu ({referenceDocsCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterDriveOnly(!filterDriveOnly)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      filterDriveOnly
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <HardDrive className="w-3 h-3" />
                    <span>Google Drive</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Quick Type Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Phân loại nhanh:</span>
              {[
                { label: 'Tất cả', value: 'ALL' },
                { label: 'Nghị quyết', value: 'NGHI_QUYET' },
                { label: 'Quyết định', value: 'QUYET_DINH' },
                { label: 'Chỉ thị', value: 'CHI_THI' },
                { label: 'Kết luận', value: 'KET_LUAN' },
                { label: 'Thông báo', value: 'THONG_BAO' },
                { label: 'Công văn', value: 'CONG_VAN' },
                { label: 'Tờ trình', value: 'TO_TRINH' },
                { label: 'Báo cáo', value: 'BAO_CAO' },
                { label: 'Kế hoạch', value: 'KE_HOACH' },
              ].map(chip => (
                <button
                  type="button"
                  key={chip.value}
                  onClick={() => setFilterType(chip.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    filterType === chip.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

          </div>
        )}

        {/* ACTIVE FILTERS SUMMARY BAR */}
        {isAnyFilterActive && (
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black text-blue-900 text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3 text-blue-700" />
                <span>Đang lọc:</span>
              </span>

              {/* Date Tag */}
              {(filterStartDate || filterEndDate) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-300 text-blue-900 rounded-lg text-xs font-bold shadow-2xs">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  <span>
                    {filterStartDate ? formatDateToDMY(filterStartDate) : 'Từ trước'} ➔ {filterEndDate ? formatDateToDMY(filterEndDate) : 'Đến nay'}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                    className="ml-1 hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Type Tag */}
              {filterType !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-300 text-blue-900 rounded-lg text-xs font-bold shadow-2xs">
                  <FileText className="w-3 h-3 text-blue-600" />
                  <span>{currentDocTypeLabel}</span>
                  <button 
                    type="button" 
                    onClick={() => setFilterType('ALL')}
                    className="ml-1 hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Authority Tag */}
              {filterAuthority !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-blue-300 text-blue-900 rounded-lg text-xs font-bold shadow-2xs">
                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                  <span>{filterAuthority === 'STANDING_BOARD' ? 'Ban Thường vụ / Thường trực' : 'UBND'}</span>
                  <button 
                    type="button" 
                    onClick={() => setFilterAuthority('ALL')}
                    className="ml-1 hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Reference Tag */}
              {filterReferenceOnly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-300 text-indigo-900 rounded-lg text-xs font-bold shadow-2xs">
                  <BookOpen className="w-3 h-3 text-indigo-600" />
                  <span>Kho Tra Cứu</span>
                  <button 
                    type="button" 
                    onClick={() => setFilterReferenceOnly(false)}
                    className="ml-1 hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Drive Tag */}
              {filterDriveOnly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 text-emerald-900 rounded-lg text-xs font-bold shadow-2xs">
                  <HardDrive className="w-3 h-3 text-emerald-600" />
                  <span>Google Drive</span>
                  <button 
                    type="button" 
                    onClick={() => setFilterDriveOnly(false)}
                    className="ml-1 hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
        )}
      </div>

      {/* AI Answer Card (If AI Semantic Mode enabled) */}
      {aiAnalysisResult && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-blue-400/30 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Tổng hợp Tham mưu từ AI Gemini</span>
          </div>
          <p className="text-xs leading-relaxed text-blue-50 font-normal">
            {aiAnalysisResult.aiAnswerSummary}
          </p>
          <div className="text-[10px] text-blue-200/80 pt-2 border-t border-white/10 flex items-center justify-between">
            <span>Tìm thấy {aiAnalysisResult.matchedDocIndexes?.length || 0} văn bản có liên quan trực tiếp</span>
            <span>Đã thẩm định ngữ nghĩa tự động</span>
          </div>
        </div>
      )}

      {/* When user hasn't searched yet and no filter is active: Show Recent Reference Docs Library */}
      {!hasSearched && !isAnyFilterActive && recentReferenceDocs.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-2xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Tài liệu & Căn cứ pháp lý tra cứu đã nạp gần đây ({referenceDocsCount})
              </h3>
            </div>
            <button
              onClick={() => {
                setFilterReferenceOnly(true);
                setResults(poolDocs.filter(d => 
                  d.isReferenceDoc || 
                  (d.tags || []).includes('TRA_CUU_THAM_KHAO') || 
                  (d.tags || []).includes('Văn bản tra cứu') ||
                  !!d.referenceCategory
                ));
                setHasSearched(true);
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Xem tất cả kho tài liệu</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentReferenceDocs.map(doc => (
              <div
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}`)}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 text-[10px] font-black rounded border border-indigo-200">
                    📚 Tài liệu tra cứu
                  </span>
                  {doc.issuedDate && (
                    <span className="text-[10px] text-slate-400 font-medium">{doc.issuedDate}</span>
                  )}
                </div>
                <h4 className="font-bold text-xs text-slate-800 group-hover:text-indigo-700 line-clamp-2 leading-snug">
                  {doc.documentNumber ? `[${doc.documentNumber}] ` : ''}{doc.title || doc.fileName}
                </h4>
                {doc.summary && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {doc.summary}
                  </p>
                )}
                {doc.uploadedByName && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-200/60">
                    <User className="w-2.5 h-2.5" />
                    <span>Nạp bởi: <strong>{doc.uploadedByName}</strong></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Results List */}
      {(hasSearched || isAnyFilterActive) && (
        <div className="bg-white rounded-3xl shadow-2xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-800 text-xs uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>Kết quả truy xuất ({displayResults.length} văn bản)</span>
              {searchTerm && <span className="text-slate-400 font-normal">cho từ khóa "{searchTerm}"</span>}
            </div>
            {displayResults.length > 0 && (
              <span className="text-[11px] text-slate-400 font-normal normal-case">
                Nhấp vào văn bản để xem Phiếu trình & Nội dung chi tiết
              </span>
            )}
          </div>
          
          {isSearching ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
              <div className="text-xs text-slate-600 font-bold">Đang quét toàn văn dữ liệu & đồng bộ Google Drive...</div>
            </div>
          ) : displayResults.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <p className="font-bold text-slate-600">Không tìm thấy văn bản nào thỏa mãn các điều kiện tìm kiếm và bộ lọc.</p>
              <p className="text-[11px] text-slate-400">Hãy thử mở rộng khoảng thời gian hoặc đổi loại văn bản để tra cứu rộng hơn.</p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại tất cả bộ lọc</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {displayResults.map(doc => {
                const driveLink = doc.driveUrl || (doc.driveFileId ? `https://drive.google.com/file/d/${doc.driveFileId}/view` : null);
                const matchReason = docMatchReasons[doc.id];

                return (
                  <div 
                    key={doc.id} 
                    className="p-5 hover:bg-blue-50/40 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4 group"
                  >
                    <div 
                      className="flex items-start gap-3.5 min-w-0 flex-1 cursor-pointer"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <div className="w-10 h-10 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-600 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-all shadow-2xs">
                        <FileText className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {(doc.isReferenceDoc || (doc.tags || []).includes('TRA_CUU_THAM_KHAO')) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-black rounded-md">
                              <BookOpen className="w-2.5 h-2.5 text-indigo-700" />
                              Tài liệu Tra cứu
                            </span>
                          )}
                          <span className="text-[11px] font-black text-slate-900">{doc.documentNumber || 'Số: Đang cập nhật'}</span>
                          {doc.documentType && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold rounded-md">
                              {doc.documentType}
                            </span>
                          )}
                          {doc.proposedAction && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-extrabold rounded-md">
                              {doc.proposedAction}
                            </span>
                          )}
                          {doc.leadDepartment && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-md">
                              Chủ trì: {doc.leadDepartment}
                            </span>
                          )}
                          {driveLink && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-extrabold rounded-full">
                              <HardDrive className="w-2.5 h-2.5 text-emerald-600" />
                              Google Drive Sync
                            </span>
                          )}
                          {doc.uploadedByName && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-medium rounded">
                              <User className="w-2 h-2 text-slate-400" />
                              {doc.uploadedByName}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                          {doc.title || doc.fileName}
                        </h3>

                        {/* AI Match Reason or Summary snippet */}
                        {matchReason ? (
                          <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 font-medium flex items-start gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <span><strong>Căn cứ phù hợp:</strong> {matchReason}</span>
                          </div>
                        ) : doc.summary ? (
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {doc.summary}
                          </p>
                        ) : doc.fullContent ? (
                          <p className="text-xs text-slate-500 line-clamp-2 italic leading-relaxed">
                            "{doc.fullContent}"
                          </p>
                        ) : null}

                        {/* Metadata Footer */}
                        <div className="flex flex-wrap gap-3 text-[11px] text-slate-400 font-medium pt-1">
                          {doc.issuer && <span>Cơ quan ban hành: <strong>{doc.issuer}</strong></span>}
                          {doc.issuedDate && <span>Ngày ký: <strong>{formatDateToDMY(doc.issuedDate)}</strong></span>}
                          {doc.receivedDate && <span>Ngày nhận: <strong>{formatDateToDMY(doc.receivedDate)}</strong></span>}
                          {doc.actionDeadline && <span className="text-blue-700 font-bold">Hạn báo cáo: {doc.actionDeadline}</span>}
                        </div>

                        {/* Document Tags */}
                        {(() => {
                          const tags = getDocumentTags(doc);
                          if (tags.length === 0) return null;
                          return (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {tags.map((t) => {
                                const style = getTagStyle(t);
                                return (
                                  <span
                                    key={t}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${style.bgClass}`}
                                  >
                                    <span>{style.icon}</span>
                                    <span>{t}</span>
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 pt-2 md:pt-0">
                      {driveLink && (
                        <a
                          href={driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
                          title="Mở tệp gốc trên Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Drive</span>
                        </a>
                      )}

                      <button
                        onClick={() => setSelectedSlipDoc(doc)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                        title="Xem Phiếu Trình"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span className="hidden sm:inline">Phiếu Trình</span>
                      </button>

                      <button
                        onClick={() => navigate(`/documents/${doc.id}`)}
                        className="p-1.5 text-slate-400 group-hover:text-blue-600 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Dispatch Slip */}
      {selectedSlipDoc && (
        <DispatchSlip document={selectedSlipDoc} onClose={() => setSelectedSlipDoc(null)} />
      )}
    </div>
  );
}

