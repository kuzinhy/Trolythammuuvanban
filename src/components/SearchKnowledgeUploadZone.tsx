import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, 
  Sparkles, HardDrive, Tag, BookOpen, Layers, X, Plus, ExternalLink,
  ShieldCheck, ArrowRight, FolderPlus
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, getAccessToken, setCachedAccessToken } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { Document } from '../types';
import { safeFetchJson } from '../lib/safeFetch';

interface SearchKnowledgeUploadZoneProps {
  onDocumentAdded: (newDoc: Document) => void;
  referenceDocsCount: number;
}

export const REFERENCE_CATEGORIES = [
  { id: 'LEGAL_DOC', label: 'Văn bản quy phạm pháp luật / Căn cứ pháp lý', icon: '⚖️' },
  { id: 'PARTY_DIRECTIVE', label: 'Nghị quyết, Chỉ thị, Quyết định Cấp ủy', icon: '🏛️' },
  { id: 'PLAN_PROJECT', label: 'Kế hoạch, Đề án, Chương trình trọng điểm', icon: '📊' },
  { id: 'GUIDELINE_MANUAL', label: 'Văn bản hướng dẫn chuyên môn & Quy chế', icon: '📘' },
  { id: 'GENERAL_REFERENCE', label: 'Tài liệu tham khảo / Sổ tay nghiệp vụ chung', icon: '📂' },
];

export default function SearchKnowledgeUploadZone({ onDocumentAdded, referenceDocsCount }: SearchKnowledgeUploadZoneProps) {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(REFERENCE_CATEGORIES[0].id);
  const [customTags, setCustomTags] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successDoc, setSuccessDoc] = useState<Document | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setSuccessDoc(null);
    setUploadStep('Đang tiếp nhận tệp tài liệu tra cứu...');

    try {
      let workspaceToken: string | null = await getAccessToken();

      if (!workspaceToken) {
        try {
          const tokenRes = await safeFetchJson("/_system/workspace/token");
          if (tokenRes.ok && tokenRes.data) {
            workspaceToken = tokenRes.data.token;
          }
        } catch (e) {
          console.warn("Workspace token lookup:", e);
        }
      }

      setUploadStep('AI Gemini đang OCR, trích xuất toàn văn & lập chỉ mục tìm kiếm...');

      const formData = new FormData();
      formData.append('file', file);
      const targetFolderId = '1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY';
      formData.append('folderId', targetFolderId);
      if (workspaceToken) {
        formData.append('workspaceToken', workspaceToken);
      }

      const uploadRes = await safeFetchJson('/api/analyze', {
        method: 'POST',
        headers: workspaceToken ? { 'Authorization': `Bearer ${workspaceToken}` } : {},
        body: formData,
      });

      if (!uploadRes.ok || !uploadRes.data) {
        throw new Error(uploadRes.error || 'Trích xuất và lập chỉ mục văn bản thất bại.');
      }
      const data = uploadRes.data;

      if (data.isDriveAuthError) {
        console.warn("[Drive] Drive token invalid or expired. Clearing cached token.");
        setCachedAccessToken(null);
      }

      setUploadStep('Đang lưu vào Kho cơ sở tri thức tra cứu...');

      const categoryObj = REFERENCE_CATEGORIES.find(c => c.id === selectedCategory);
      const parsedTags: string[] = [
        'TRA_CUU_THAM_KHAO',
        'Văn bản tra cứu',
        categoryObj ? categoryObj.label : 'Tài liệu tra cứu',
      ];

      if (customTags.trim()) {
        const extra = customTags.split(',').map(t => t.trim()).filter(Boolean);
        parsedTags.push(...extra);
      }

      const newDocData: any = {
        ...data.analysis,
        driveFileId: data.driveFileId || null,
        driveUrl: data.driveUrl || null,
        driveFolderUrl: data.driveFolderUrl || null,
        fileName: file.name,
        mimeType: data.mimeType || file.type,
        status: 'ANALYZED',
        createdBy: user?.uid || null,
        uploadedByName: user?.displayName || user?.email?.split('@')[0] || 'Cán bộ tra cứu',
        uploadedByEmail: user?.email || null,
        isImportant: true,
        isStarred: true,
        isReferenceDoc: true,
        referenceCategory: selectedCategory,
        tags: Array.from(new Set([...(data.analysis?.tags || []), ...parsedTags])),
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'documents'), newDocData);
      const createdDoc: Document = {
        id: docRef.id,
        ...newDocData,
        createdAt: new Date().toISOString(),
      };

      setSuccessDoc(createdDoc);
      onDocumentAdded(createdDoc);
      setCustomTags('');
    } catch (err: any) {
      console.error("Upload knowledge reference error:", err);
      setError(err.message || "Tải lên và lập chỉ mục văn bản thất bại.");
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  }, [selectedCategory, customTags, user, onDocumentAdded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    disabled: isUploading,
  } as any);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/30 overflow-hidden relative">
      {/* Background Glow Decorative FX */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Toggle & Count */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3 text-amber-300" />
              KHO TÀI LIỆU & VĂN BẢN NGUỒN TRA CỨU
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-blue-200 border border-white/10 text-[10px] font-bold">
              {referenceDocsCount} tài liệu đã lập chỉ mục
            </span>
          </div>
          <h2 className="text-sm md:text-base font-black tracking-tight text-white flex items-center gap-2">
            <span>Tiếp Nhận & Tải Lên Văn Bản Để Tra Cứu Toàn Văn & AI Thẩm Định</span>
          </h2>
          <p className="text-xs text-blue-200/80 max-w-2xl leading-relaxed font-normal">
            Tải lên các văn bản quy phạm pháp luật, chỉ thị, nghị quyết, đề án hoặc tài liệu tham khảo cần thiết. AI Gemini sẽ tự động trích xuất toàn văn, phân tích điều khoản và lập chỉ mục để bạn tra cứu nhanh bất cứ lúc nào.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (isOpen) {
              setSuccessDoc(null);
              setError(null);
            }
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md flex-shrink-0 active:scale-95 ${
            isOpen
              ? 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white border border-blue-400/30'
          }`}
        >
          {isOpen ? (
            <>
              <X className="w-4 h-4" />
              <span>Thu gọn khung tải lên</span>
            </>
          ) : (
            <>
              <FolderPlus className="w-4 h-4 text-amber-300" />
              <span>+ Tải lên tài liệu tra cứu mới</span>
            </>
          )}
        </button>
      </div>

      {/* Expanded Upload Area */}
      {isOpen && (
        <div className="mt-6 pt-6 border-t border-white/10 space-y-5 relative z-10 animate-in fade-in slide-in-from-top-4 duration-200">
          {/* Step 1: Category & Tags Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Category Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-blue-200 uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>1. Phân loại tài liệu tra cứu:</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={isUploading}
                className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all cursor-pointer"
              >
                {REFERENCE_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Lookup Tags */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-blue-200 uppercase tracking-wide flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                <span>2. Từ khóa tra cứu nhanh (tùy chọn, cách nhau dấu phẩy):</span>
              </label>
              <input
                type="text"
                value={customTags}
                onChange={(e) => setCustomTags(e.target.value)}
                disabled={isUploading}
                placeholder="Ví dụ: Đất đai 2024, Quy hoạch đô thị, Đầu tư công..."
                className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Step 2: Dropzone Container */}
          <div
            {...getRootProps()}
            className={`
              relative rounded-2xl p-6 md:p-8 border-2 border-dashed text-center transition-all cursor-pointer
              ${isDragActive 
                ? 'border-blue-400 bg-blue-500/20 scale-[0.99]' 
                : isUploading
                  ? 'border-slate-700 bg-slate-800/50 cursor-not-allowed opacity-80'
                  : 'border-blue-400/40 bg-slate-800/40 hover:bg-slate-800/80 hover:border-blue-400'
              }
            `}
          >
            <input {...getInputProps()} />

            {isUploading ? (
              <div className="space-y-3 py-4 flex flex-col items-center justify-center">
                <div className="relative">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                  <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs font-bold text-white tracking-wide">{uploadStep}</p>
                  <p className="text-[11px] text-blue-300/80">Quá trình này tự động quét OCR tiếng Việt và trích xuất chỉ mục toàn văn</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 py-2 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xs font-bold text-white">
                    Kéo thả tệp văn bản vào đây, hoặc <span className="text-blue-400 underline underline-offset-2">chọn từ máy tính</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Hỗ trợ tệp PDF, DOCX, DOC, Hình ảnh văn bản scan (PNG, JPG), TXT (Tối đa 50MB)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <div className="font-bold">Lỗi khi tải lên và lập chỉ mục:</div>
                <div>{error}</div>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-white text-xs">✕</button>
            </div>
          )}

          {/* Success Banner */}
          {successDoc && (
            <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-100 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Đã tải lên và lập chỉ mục tra cứu thành công!</span>
                </div>
                <button
                  onClick={() => setSuccessDoc(null)}
                  className="text-emerald-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 bg-black/30 rounded-xl space-y-1">
                <div className="font-extrabold text-white text-xs">
                  {successDoc.documentNumber ? `[${successDoc.documentNumber}] ` : ''}{successDoc.title || successDoc.fileName}
                </div>
                {successDoc.issuer && (
                  <div className="text-[11px] text-emerald-200/80">
                    Cơ quan ban hành: <strong>{successDoc.issuer}</strong>
                  </div>
                )}
                {successDoc.summary && (
                  <p className="text-[11px] text-slate-300 line-clamp-2 italic pt-1">
                    "{successDoc.summary}"
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[10px] text-emerald-300 font-semibold">
                  ✓ Bạn có thể tra cứu toàn văn văn bản này ngay bên dưới bằng từ khóa hoặc câu hỏi AI.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
