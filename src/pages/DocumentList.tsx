import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Document } from '../types';
import { Eye, Loader2, Search, Plus, Printer, ShieldAlert, HardDrive, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import DispatchSlip from '../components/DispatchSlip';

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'STANDING_BOARD' | 'URGENT' | 'HAS_DEADLINE' | 'DRIVE'>('ALL');
  const [selectedSlipDoc, setSelectedSlipDoc] = useState<Document | null>(null);

  // Debounce search term to avoid re-filtering every millisecond
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
      if (term) {
        const matchesSearch = 
          (doc.documentNumber || '').toLowerCase().includes(term) ||
          (doc.title || doc.fileName || '').toLowerCase().includes(term) ||
          (doc.issuer || '').toLowerCase().includes(term) ||
          (doc.leadDepartment || '').toLowerCase().includes(term) ||
          (doc.proposedAction || '').toLowerCase().includes(term);

        if (!matchesSearch) return false;
      }

      if (filterType === 'STANDING_BOARD') {
        return (doc.proposedAction || '').includes('Ban Thường vụ') || (doc.proposedAction || '').includes('Thường trực');
      }
      if (filterType === 'URGENT') {
        return doc.urgency && doc.urgency !== 'Thường';
      }
      if (filterType === 'HAS_DEADLINE') {
        return !!doc.actionDeadline || (doc.deadlines && doc.deadlines.length > 0);
      }
      if (filterType === 'DRIVE') {
        return !!(doc.driveFileId || doc.driveUrl);
      }
      return true;
    });
  }, [documents, debouncedSearch, filterType]);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs text-slate-500 font-medium">Đang tải danh sách văn bản...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans transform-gpu">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Sổ Đăng Ký & Quản Lý Văn Bản</h1>
          <p className="text-xs text-slate-500 mt-0.5">Tổng số: {documents.length} văn bản đã tiếp nhận & phân luồng</p>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            to="/" 
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl shadow-xs hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tiếp nhận văn bản mới</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo số hiệu, trích yếu, cơ quan, phân luồng..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-800 placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterType === 'ALL'
                ? 'bg-slate-900 text-white font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({documents.length})
          </button>
          <button
            onClick={() => setFilterType('STANDING_BOARD')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              filterType === 'STANDING_BOARD'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            <span>Trình BTV</span>
          </button>
          <button
            onClick={() => setFilterType('URGENT')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterType === 'URGENT'
                ? 'bg-sky-600 text-white font-bold'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            Khẩn / Mật
          </button>
          <button
            onClick={() => setFilterType('DRIVE')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              filterType === 'DRIVE'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <HardDrive className="w-3 h-3" />
            <span>Google Drive</span>
          </button>
          <button
            onClick={() => setFilterType('HAS_DEADLINE')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filterType === 'HAS_DEADLINE'
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            Có hạn báo cáo
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Số / Ký hiệu</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trích yếu & Cơ quan</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đề xuất Tham mưu</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ quan chủ trì</th>
                <th className="px-6 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-xs">
              {filteredDocs.map((doc) => {
                const driveLink = doc.driveUrl || (doc.driveFileId ? `https://drive.google.com/file/d/${doc.driveFileId}/view` : null);
                return (
                  <tr key={doc.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{doc.documentNumber || 'Số: Đang cập nhật'}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{doc.issuedDate || 'Ngày: N/A'}</div>
                      <div className="flex items-center gap-1 mt-1">
                        {doc.urgency && doc.urgency !== 'Thường' && (
                          <span className="inline-block px-1.5 py-0.2 bg-sky-100 text-sky-800 text-[9px] font-bold rounded">
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
                    <td className="px-6 py-4 max-w-sm">
                      <Link to={`/documents/${doc.id}`} className="font-semibold text-slate-900 hover:text-blue-600 transition-colors line-clamp-2">
                        {doc.title || doc.fileName}
                      </Link>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {doc.issuer || 'Chưa rõ cơ quan gửi'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {doc.proposedAction ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {doc.proposedAction}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Chưa phân luồng</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{doc.leadDepartment || 'Văn phòng'}</div>
                      {doc.actionDeadline && (
                        <div className="text-[11px] text-blue-700 font-semibold mt-0.5">
                          Hạn: {doc.actionDeadline}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {driveLink && (
                          <a
                            href={driveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Mở tệp trên Google Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedSlipDoc(doc)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Xem Phiếu trình"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <Link 
                          to={`/documents/${doc.id}`} 
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Chi tiết</span>
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400">
                    Không tìm thấy văn bản nào phù hợp với bộ lọc.
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
