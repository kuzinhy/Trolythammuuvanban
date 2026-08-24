import React, { useState, useMemo } from 'react';
import { 
  Star, FileText, AlertCircle, ShieldAlert, Sparkles, 
  ExternalLink, HardDrive, Clock, CheckCircle2, Building2, 
  Printer, ArrowRight, UploadCloud, Search, Filter,
  User, Calendar, Flame, Eye, ChevronRight, Check
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Document } from '../types';
import { useAuthStore } from '../store/authStore';
import DispatchSlip from './DispatchSlip';
import { parseDateString } from '../lib/documentUtils';

interface ImportantDocumentsSectionProps {
  documents: Document[];
  onUploadClick?: () => void;
}

export type ImportantFilterType = 'ALL_IMPORTANT' | 'MY_UPLOADS' | 'URGENT' | 'STANDING_BOARD' | 'HAS_DEADLINE';

export default function ImportantDocumentsSection({ documents, onUploadClick }: ImportantDocumentsSectionProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<ImportantFilterType>('ALL_IMPORTANT');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSlipDoc, setSelectedSlipDoc] = useState<Document | null>(null);
  const [starTogglingId, setStarTogglingId] = useState<string | null>(null);

  // Helper to check if a document is considered "Important"
  const isDocImportant = (docItem: Document): boolean => {
    if (docItem.isImportant || docItem.isStarred) return true;
    
    // Check urgency
    const urgency = (docItem.urgency || '').toUpperCase();
    if (
      urgency.includes('HOA_TOC') || 
      urgency.includes('HỎA TỐC') || 
      urgency.includes('THUONG_KHAN') || 
      urgency.includes('THƯỢNG KHẨN') || 
      urgency.includes('KHẨN')
    ) return true;

    // Check leadership routing
    const action = docItem.proposedAction || '';
    if (
      action.includes('Ban Thường vụ') || 
      action.includes('Thường trực') || 
      action.includes('Bí thư') ||
      action.includes('Chủ tịch')
    ) return true;

    // Check confidentiality
    const conf = (docItem.confidentiality || '').toUpperCase();
    if (conf.includes('MẬT') || conf.includes('TỐI MẬT') || conf.includes('TUYỆT MẬT')) return true;

    // Check tags
    if (docItem.tags && (docItem.tags.includes('QUAN_TRONG') || docItem.tags.includes('Văn bản quan trọng') || docItem.tags.includes('Văn bản trọng tâm'))) return true;

    return false;
  };

  // Helper to check if uploaded by current user
  const isUploadedByUser = (docItem: Document): boolean => {
    if (!user) return !!docItem.createdBy;
    return docItem.createdBy === user.uid || (!!docItem.uploadedByEmail && docItem.uploadedByEmail === user.email);
  };

  // Toggle Star / Importance in Firestore
  const handleToggleStar = async (e: React.MouseEvent, docItem: Document) => {
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

  // Filtered list
  const importantDocs = useMemo(() => {
    return documents.filter(docItem => {
      // Search matching
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const num = (docItem.documentNumber || '').toLowerCase();
        const title = (docItem.title || docItem.fileName || '').toLowerCase();
        const issuer = (docItem.issuer || '').toLowerCase();
        const dept = (docItem.leadDepartment || '').toLowerCase();
        const action = (docItem.proposedAction || '').toLowerCase();
        const uploader = (docItem.uploadedByName || docItem.uploadedByEmail || '').toLowerCase();
        
        const matches = num.includes(query) || title.includes(query) || issuer.includes(query) || 
                        dept.includes(query) || action.includes(query) || uploader.includes(query);
        if (!matches) return false;
      }

      // Filter types
      if (filterType === 'MY_UPLOADS') {
        return isUploadedByUser(docItem);
      }

      if (filterType === 'URGENT') {
        const urgency = (docItem.urgency || '').toUpperCase();
        return (
          urgency.includes('HOA_TOC') || 
          urgency.includes('HỎA TỐC') || 
          urgency.includes('THUONG_KHAN') || 
          urgency.includes('THƯỢNG KHẨN') || 
          urgency.includes('KHẨN')
        );
      }

      if (filterType === 'STANDING_BOARD') {
        const action = docItem.proposedAction || '';
        return action.includes('Ban Thường vụ') || action.includes('Thường trực');
      }

      if (filterType === 'HAS_DEADLINE') {
        return !!docItem.actionDeadline;
      }

      // Default 'ALL_IMPORTANT': Either marked important or user-uploaded or urgent/standing board
      return isDocImportant(docItem) || isUploadedByUser(docItem);
    });
  }, [documents, filterType, searchQuery, user]);

  // Overall counts for badges
  const totalCount = useMemo(() => {
    return documents.filter(d => isDocImportant(d) || isUploadedByUser(d)).length;
  }, [documents, user]);

  const myUploadsCount = useMemo(() => {
    return documents.filter(d => isUploadedByUser(d)).length;
  }, [documents, user]);

  const urgentCount = useMemo(() => {
    return documents.filter(d => {
      const u = (d.urgency || '').toUpperCase();
      return u.includes('HOA_TOC') || u.includes('HỎA TỐC') || u.includes('THUONG_KHAN') || u.includes('THƯỢNG KHẨN') || u.includes('KHẨN');
    }).length;
  }, [documents]);

  const standingBoardCount = useMemo(() => {
    return documents.filter(d => (d.proposedAction || '').includes('Ban Thường vụ') || (d.proposedAction || '').includes('Thường trực')).length;
  }, [documents]);

  // Helper for deadline status
  const getDeadlineBadge = (deadlineStr: string | null | undefined) => {
    if (!deadlineStr) return null;
    const parsed = parseDateString(deadlineStr);
    if (!parsed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>Hạn: {deadlineStr}</span>
        </span>
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(parsed);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-300 text-[10px] font-black animate-pulse">
          <AlertCircle className="w-3 h-3 text-red-600" />
          <span>Quá hạn {Math.abs(diffDays)} ngày ({deadlineStr})</span>
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
          <Clock className="w-3 h-3 text-amber-700" />
          <span>Hạn chót: Hôm nay ({deadlineStr})</span>
        </span>
      );
    } else if (diffDays <= 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-bold">
          <Clock className="w-3 h-3 text-orange-600" />
          <span>Còn {diffDays} ngày ({deadlineStr})</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold">
        <Calendar className="w-3 h-3 text-slate-500" />
        <span>Hạn xử lý: {deadlineStr}</span>
      </span>
    );
  };

  return (
    <section 
      id="important-user-documents-section"
      className="bg-white rounded-3xl border border-slate-200/90 shadow-md shadow-slate-200/40 overflow-hidden transition-all"
    >
      {/* Header with GenZ Tech Accent Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-blue-500/10 to-indigo-500/10 p-5 md:p-6 border-b border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <Star className="w-3 h-3 fill-white" />
                VĂN BẢN TRỌNG TÂM & NGƯỜI DÙNG TẢI LÊN
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold">
                {importantDocs.length} hồ sơ theo dõi
              </span>
            </div>
            <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Hồ Sơ Văn Bản Quan Trọng Cần Chỉ Đạo & Đôn Đốc</span>
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Khu vực hiển thị ưu tiên các công văn do người dùng trực tiếp tải lên, văn bản Hỏa tốc/Thượng khẩn, hồ sơ trình Thường trực Cấp ủy và các văn bản được đánh dấu sao quan trọng.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {onUploadClick && (
              <button
                onClick={onUploadClick}
                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/25 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Tải lên văn bản mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Tabs Toolbar */}
        <div className="mt-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-200/60">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs no-scrollbar">
            <button
              onClick={() => setFilterType('ALL_IMPORTANT')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                filterType === 'ALL_IMPORTANT'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${filterType === 'ALL_IMPORTANT' ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
              <span>Tất cả trọng tâm ({totalCount})</span>
            </button>

            <button
              onClick={() => setFilterType('MY_UPLOADS')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                filterType === 'MY_UPLOADS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Do tôi tải lên ({myUploadsCount})</span>
            </button>

            <button
              onClick={() => setFilterType('URGENT')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                filterType === 'URGENT'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${filterType === 'URGENT' ? 'text-amber-300' : 'text-red-500'}`} />
              <span>Hỏa tốc & Khẩn ({urgentCount})</span>
            </button>

            <button
              onClick={() => setFilterType('STANDING_BOARD')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                filterType === 'STANDING_BOARD'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Trình Thường trực ({standingBoardCount})</span>
            </button>

            <button
              onClick={() => setFilterType('HAS_DEADLINE')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                filterType === 'HAS_DEADLINE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Có hạn xử lý</span>
            </button>
          </div>

          {/* Quick Search inside Important Section */}
          <div className="relative flex-shrink-0 min-w-[220px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm số hiệu, trích yếu..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main List Container */}
      <div className="p-4 md:p-6">
        {importantDocs.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 border border-amber-200 mx-auto flex items-center justify-center">
              <Star className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Chưa có văn bản nào trong mục này
              </h3>
              <p className="text-xs text-slate-500">
                {searchQuery 
                  ? `Không tìm thấy kết quả phù hợp với từ khóa "${searchQuery}".` 
                  : filterType === 'MY_UPLOADS' 
                    ? 'Bạn chưa tải lên văn bản nào. Hãy kéo thả tệp văn bản ở khung trên để tải lên!'
                    : 'Nhấn vào biểu tượng ngôi sao ⭐ trên bất kỳ văn bản nào để ghim văn bản vào danh sách quan trọng.'}
              </p>
            </div>
            {onUploadClick && (
              <button
                onClick={onUploadClick}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Tải lên văn bản ngay</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {importantDocs.map((docItem) => {
              const isStarred = !!(docItem.isImportant || docItem.isStarred);
              const urgencyStr = (docItem.urgency || '').toUpperCase();
              const isUrgent = urgencyStr.includes('HOA_TOC') || urgencyStr.includes('HỎA TỐC') || urgencyStr.includes('THUONG_KHAN') || urgencyStr.includes('THƯỢNG KHẨN') || urgencyStr.includes('KHẨN');
              const isStandingBoard = (docItem.proposedAction || '').includes('Ban Thường vụ') || (docItem.proposedAction || '').includes('Thường trực');
              const isConfidential = (docItem.confidentiality || '').toUpperCase().includes('MẬT');
              const isUploadedByMe = isUploadedByUser(docItem);

              return (
                <div
                  key={docItem.id}
                  onClick={() => navigate(`/documents/${docItem.id}`)}
                  className={`
                    group relative rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between
                    ${isStarred 
                      ? 'bg-gradient-to-br from-amber-50/40 via-white to-blue-50/30 border-amber-200/90 shadow-sm hover:shadow-md hover:border-amber-300' 
                      : 'bg-white border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300'
                    }
                  `}
                >
                  <div className="space-y-3">
                    {/* Top Row: Badges & Star Button */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Star / Urgency Badges */}
                        {isStarred && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            <span>TRỌNG TÂM</span>
                          </span>
                        )}

                        {isUrgent && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                            urgencyStr.includes('HOA_TOC') || urgencyStr.includes('HỎA TỐC')
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'bg-orange-100 text-orange-800 border border-orange-300'
                          }`}>
                            <Flame className="w-3 h-3" />
                            <span>{docItem.urgency}</span>
                          </span>
                        )}

                        {isStandingBoard && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                            Trình Thường trực
                          </span>
                        )}

                        {isConfidential && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black">
                            {docItem.confidentiality}
                          </span>
                        )}

                        {isUploadedByMe && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-semibold flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-blue-600" />
                            <span>Bạn đã tải lên</span>
                          </span>
                        )}

                        {(docItem.driveFileId || docItem.driveUrl) && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold flex items-center gap-1">
                            <HardDrive className="w-2.5 h-2.5" />
                            <span>Drive</span>
                          </span>
                        )}
                      </div>

                      {/* Star Toggle Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleStar(e, docItem)}
                        disabled={starTogglingId === docItem.id}
                        className={`p-1.5 rounded-xl transition-all cursor-pointer flex-shrink-0 ${
                          isStarred 
                            ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
                            : 'bg-slate-100 text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                        }`}
                        title={isStarred ? "Bỏ đánh dấu quan trọng" : "Đánh dấu văn bản quan trọng"}
                      >
                        <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-500 text-amber-500' : ''}`} />
                      </button>
                    </div>

                    {/* Document Number & Title */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-slate-900 font-mono tracking-tight bg-slate-100 px-2 py-0.5 rounded">
                          {docItem.documentNumber || 'Số: Đang thẩm định'}
                        </span>
                        {docItem.issuedDate && (
                          <span className="text-[11px] text-slate-500">
                            Ngày: {docItem.issuedDate}
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-xs md:text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">
                        {docItem.title || docItem.fileName}
                      </h3>
                      
                      {docItem.issuer && (
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="truncate">Cơ quan ban hành: <strong className="font-semibold text-slate-700">{docItem.issuer}</strong></span>
                        </p>
                      )}
                    </div>

                    {/* Proposed Action / Advisory Opinion Box */}
                    {docItem.proposedAction && (
                      <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-100/90 text-xs text-blue-900 space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-blue-600" />
                          <span>Đề xuất phân luồng:</span>
                        </div>
                        <p className="font-bold text-slate-900 text-xs line-clamp-2 leading-relaxed">
                          {docItem.proposedAction}
                        </p>
                      </div>
                    )}

                    {/* Metadata Badges: Lead Dept, Officer, Deadline */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {docItem.leadDepartment && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                          Chủ trì: <strong className="font-bold text-slate-900">{docItem.leadDepartment}</strong>
                        </span>
                      )}

                      {docItem.assignedDeputyChief && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-100 text-[10px] font-semibold">
                          Phụ trách: {docItem.assignedDeputyChief}
                        </span>
                      )}

                      {getDeadlineBadge(docItem.actionDeadline)}
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-400 truncate">
                      {docItem.uploadedByName ? (
                        <span>Tải bởi: <strong className="text-slate-600">{docItem.uploadedByName}</strong></span>
                      ) : (
                        <span>Tệp: {docItem.fileName}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Direct Print Dispatch Slip Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSlipDoc(docItem);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1"
                        title="In Phiếu Trình Văn bản & Bút phê"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span className="hidden sm:inline text-[11px]">Phiếu trình</span>
                      </button>

                      {/* Detail Link */}
                      <Link
                        to={`/documents/${docItem.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                      >
                        <span>Thẩm định AI</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Embedded Modal: Dispatch Slip for Quick Print */}
      {selectedSlipDoc && (
        <DispatchSlip
          document={selectedSlipDoc}
          onClose={() => setSelectedSlipDoc(null)}
        />
      )}
    </section>
  );
}
