import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Search as SearchIcon, Loader2, FileText, ChevronRight, HardDrive, 
  Sparkles, Filter, ExternalLink, Printer, ShieldAlert, BookOpen, CheckCircle2, Tag 
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { Document } from '../types';
import DispatchSlip from '../components/DispatchSlip';
import { getDocumentTags, getTagStyle, STANDARD_TAGS } from '../lib/tagUtils';

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

  // Advanced Filter States
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterAuthority, setFilterAuthority] = useState<string>('ALL');
  const [filterDriveOnly, setFilterDriveOnly] = useState<boolean>(false);

  const cachedDocsRef = useRef<Document[] | null>(null);
  const navigate = useNavigate();

  // Load candidate documents pool on mount into ref cache
  useEffect(() => {
    const fetchPool = async () => {
      try {
        const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(300));
        const snapshot = await getDocs(q);
        cachedDocsRef.current = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
      } catch (e) {
        console.error("Error caching documents for search:", e);
      }
    };
    fetchPool();
  }, []);

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

      return (
        matchNumber || matchTitle || matchFileName || matchSummary || matchFullContent ||
        matchProposed || matchLead || matchIssuer || matchKeywords || matchDirectives ||
        matchLegalBasis || matchOrgs || matchPersons
      );
    });
  }, []);

  const handleSearch = async (e?: FormEvent, customTerm?: string) => {
    if (e) e.preventDefault();
    const queryTerm = (customTerm !== undefined ? customTerm : searchTerm).trim();
    if (!queryTerm) return;

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

      if (searchMode === 'FULL_TEXT') {
        const filtered = performKeywordFilter(pool, queryTerm);
        setResults(filtered);
      } else {
        // AI Semantic Deep Inquiry Mode
        const res = await fetch('/api/search-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: queryTerm,
            documents: pool
          })
        });

        if (!res.ok) throw new Error("Tra cứu AI thất bại");
        const aiData: AISearchResult = await res.json();
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

  // Apply Secondary Filters (Authority, Type, Drive)
  const displayResults = results.filter(doc => {
    if (filterDriveOnly && !doc.driveFileId && !doc.driveUrl) return false;

    if (filterAuthority === 'STANDING_BOARD') {
      if (!doc.proposedAction?.includes('Ban Thường vụ') && !doc.proposedAction?.includes('Thường trực')) return false;
    } else if (filterAuthority === 'UBND') {
      if (!doc.proposedAction?.includes('UBND')) return false;
    }

    if (filterType !== 'ALL') {
      const title = (doc.title || doc.fileName || '').toLowerCase();
      if (filterType === 'NGHI_QUYET' && !title.includes('nghị quyết')) return false;
      if (filterType === 'CONG_VAN' && !title.includes('công văn')) return false;
      if (filterType === 'TO_TRINH' && !title.includes('tờ trình')) return false;
      if (filterType === 'THONG_BAO' && !title.includes('thông báo')) return false;
    }

    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans transform-gpu pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Tra Cứu & Tìm Kiếm Toàn Văn Văn Bản</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full border border-blue-200">
              AI Powered
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tìm kiếm theo nội dung chi tiết trong tệp Google Drive, số hiệu, căn cứ pháp lý hoặc truy vấn bằng câu hỏi tự nhiên.
          </p>
        </div>

        {/* Toggle Mode */}
        <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold shadow-2xs">
          <button
            onClick={() => setSearchMode('FULL_TEXT')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              searchMode === 'FULL_TEXT' 
                ? 'bg-white text-blue-700 shadow-2xs font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Toàn văn & Từ khóa</span>
          </button>
          <button
            onClick={() => setSearchMode('AI_SEMANTIC')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              searchMode === 'AI_SEMANTIC' 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xs font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Trợ lý AI Tìm kiếm</span>
          </button>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
        <form onSubmit={(e) => handleSearch(e)} className="max-w-3xl mx-auto space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                searchMode === 'FULL_TEXT'
                  ? "Nhập số hiệu, từ khóa trong tệp, tên dự án, căn cứ pháp lý, Google Drive..."
                  : "Hỏi AI: 'Các văn bản quy định về hạn chót báo cáo quy hoạch tháng 8', 'Nghị quyết về nhân sự'..."
              }
              className="w-full pl-11 pr-32 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            <button 
              type="submit" 
              disabled={isSearching || !searchTerm.trim()}
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Gợi ý:</span>
              {(searchMode === 'FULL_TEXT' 
                ? ['Ban Thường vụ', 'UBND', 'Hỏa tốc', 'Sở Tư pháp', 'Google Drive', 'Giải phóng mặt bằng']
                : ['Văn bản thuộc thẩm quyền Ban Thường vụ', 'Các chỉ đạo về đầu tư công', 'Công văn giao Sở KH&ĐT', 'Văn bản có hạn trong tháng']
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
          </div>
        </form>

        {/* Filters Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-bold">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Bộ lọc kết quả:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Authority filter */}
            <select
              value={filterAuthority}
              onChange={(e) => setFilterAuthority(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">Tất cả thẩm quyền</option>
              <option value="STANDING_BOARD">Trình Ban Thường vụ / Thường trực</option>
              <option value="UBND">UBND / Ban Cán sự</option>
            </select>

            {/* Document type filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">Tất cả loại văn bản</option>
              <option value="NGHI_QUYET">Nghị quyết</option>
              <option value="CONG_VAN">Công văn</option>
              <option value="TO_TRINH">Tờ trình</option>
              <option value="THONG_BAO">Thông báo</option>
            </select>

            {/* Drive filter button */}
            <button
              onClick={() => setFilterDriveOnly(!filterDriveOnly)}
              className={`px-3 py-1 rounded-lg font-bold border transition-all flex items-center gap-1 ${
                filterDriveOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <HardDrive className="w-3 h-3" />
              <span>Chỉ hiển thị Google Drive</span>
            </button>
          </div>
        </div>
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

      {/* Search Results List */}
      {hasSearched && (
        <div className="bg-white rounded-3xl shadow-2xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
            <span>Kết quả tìm kiếm ({displayResults.length})</span>
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
              <p>Không tìm thấy văn bản nào phù hợp với từ khóa "{searchTerm}"</p>
              <p className="text-[11px] text-slate-400">Hãy thử mở rộng bộ lọc hoặc đổi từ khóa ngắn gọn hơn.</p>
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
                          <span className="text-[11px] font-black text-slate-900">{doc.documentNumber || 'Số: Đang cập nhật'}</span>
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
                          {doc.issuedDate && <span>Ngày ký: <strong>{doc.issuedDate}</strong></span>}
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
