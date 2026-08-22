import { useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { 
  FileSearch, Sparkles, Loader2, Upload, Copy, Check, AlertTriangle, 
  CheckCircle2, FileText, ArrowRight, ShieldCheck, RefreshCw, Download, BookmarkPlus, X, HelpCircle, Columns, GitCompare,
  Edit3, ClipboardList, Save
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '../store/authStore';
import * as Diff from 'diff';

interface AuditErrorItem {
  id: string;
  type: 'SPELLING' | 'FORMAT' | 'VOCABULARY' | 'STYLE';
  originalText: string;
  issueDescription: string;
  suggestedFix: string;
  explanation: string;
}

interface ParagraphSuggestion {
  originalParagraph: string;
  improvedParagraph: string;
  reason: string;
}

interface AuditResult {
  auditSummary: {
    totalErrors: number;
    spellingErrorsCount: number;
    formattingErrorsCount: number;
    vocabularyErrorsCount: number;
    overallScore: number;
    generalAssessment: string;
  };
  errorsAndIssues: AuditErrorItem[];
  paragraphSuggestions: ParagraphSuggestion[];
  fullyAuditedDocument: string;
}

export default function DocumentAudit() {
  const [documentText, setDocumentText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'errors' | 'paragraphs' | 'polished' | 'diff'>('errors');
  const [diffMode, setDiffMode] = useState<'inline' | 'sidebyside'>('inline');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  // Editable document parameters after scan
  const [docNumber, setDocNumber] = useState('Số: 128/QĐ-UBND');
  const [issuingAuthority, setIssuingAuthority] = useState('UBND Tỉnh');
  const [docSubject, setDocSubject] = useState('Về việc phê duyệt kế hoạch và rà soát văn bản');
  const [docDate, setDocDate] = useState('22/08/2026');
  const [urgencyLevel, setUrgencyLevel] = useState('Thường');
  const [signerName, setSignerName] = useState('Chủ tịch UBND Tỉnh');

  // Work processing box & notes
  const [workNotes, setWorkNotes] = useState('');
  const [processingStatus, setProcessingStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'COMPLETED'>('IN_PROGRESS');
  const [assignedTo, setAssignedTo] = useState('Phòng Tổng hợp & Đôn đốc');
  const [processingSavedMsg, setProcessingSavedMsg] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const handleSaveProcessingNotes = () => {
    setProcessingSavedMsg(true);
    setTimeout(() => setProcessingSavedMsg(false), 3000);
  };



  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setSuccessMsg(`Đã đính kèm tệp: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      setTimeout(() => setSuccessMsg(null), 3000);
      
      // If it's a txt file, read it for text preview
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setDocumentText(event.target.result as string);
          }
        };
        reader.readAsText(file);
      } else {
        setDocumentText(`[Đã đính kèm tệp nhị phân: ${file.name}. AI sẽ trực tiếp phân tích toàn văn tài liệu này.]`);
      }
    }
  };

  const handleRunAudit = async (e: FormEvent) => {
    e.preventDefault();
    if (!documentText.trim() && !selectedFile) {
      setError('Vui lòng nhập nội dung văn bản hoặc tải lên tệp tài liệu cần rà soát.');
      return;
    }

    setIsAuditing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      if (documentText.trim()) {
        formData.append('text', documentText);
      }

      const res = await fetch('/api/audit-document', {
        method: 'POST',
        body: selectedFile ? formData : JSON.stringify({ text: documentText }),
        headers: selectedFile ? undefined : { 'Content-Type': 'application/json' }
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResp = await res.text();
        if (textResp.includes('<!doctype') || textResp.includes('<html')) {
          throw new Error('Máy chủ đang khởi động lại hoặc gặp sự cố (Nhận được trang HTML). Vui lòng thử lại sau giây lát.');
        }
        throw new Error(textResp || 'Yêu cầu rà soát văn bản thất bại.');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Yêu cầu rà soát văn bản thất bại.');
      }

      setResult(data);
      setActiveTab('errors');
      setSuccessMsg('Đã hoàn tất rà soát chính tả, thể thức và tinh chỉnh văn bản thành công!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Audit error:", err);
      setError(err.message || 'Đã xảy ra lỗi khi kết nối với AI chuyên gia rà soát.');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleDownloadFile = () => {
    if (!result) return;
    const element = document.createElement("a");
    const file = new Blob([result.fullyAuditedDocument], {type: 'text/plain;charset=utf-8'});
    element.href = URL.createObjectURL(file);
    element.download = `Van_ban_da_ra_soat_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSaveToNotebook = async () => {
    if (!result) return;
    try {
      await addDoc(collection(db, 'directive_history'), {
        idea: `Rà soát & Hoàn thiện văn bản (Điểm chất lượng: ${result.auditSummary.overallScore}/100)`,
        selectedOptionText: result.fullyAuditedDocument,
        style: 'Văn bản hành chính chuẩn hóa (Nghị định 30)',
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null
      });
      setSuccessMsg("Đã lưu văn bản đã rà soát vào Sổ tay Nhật ký thành công!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Save notebook error:", err);
      setError("Không thể lưu vào sổ tay nhật ký.");
    }
  };

  const filteredErrors = result?.errorsAndIssues.filter(item => {
    if (filterType === 'ALL') return true;
    return item.type === filterType;
  }) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans pb-12 px-4 md:px-6">
      
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-indigo-900/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <FileSearch className="w-3.5 h-3.5" />
              Chuyên gia Thể thức & Chính tả
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider">
              Nghị định 30/2020/NĐ-CP & Quy chế Đảng
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>Rà Soát & Hoàn Thiện Văn Bản Hành Chính</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-200 max-w-2xl leading-relaxed font-medium">
            Tự động phát hiện lỗi chính tả, lỗi thể thức, lọc từ ngữ chưa phù hợp ngữ cảnh cơ quan Đảng & Nhà nước, đồng thời đề xuất viết lại câu sắc sảo và chuẩn mực.
          </p>
        </div>
      </div>

      {/* Real-time Toast Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-950 rounded-2xl flex items-center gap-3 text-xs border border-emerald-200 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-950 rounded-2xl flex items-center gap-3 text-xs border border-red-200 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Main Grid: Left Upload & Input (5/12), Right Audit Dashboard (7/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Input and Upload */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-xl space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>1. Tải Lên Hoặc Nhập Văn Bản</span>
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-extrabold px-2 py-0.5 rounded-lg border border-blue-200">
                Bước 1
              </span>
            </div>



            <form onSubmit={handleRunAudit} className="space-y-4">
              {/* File Upload Zone */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Tải lên tệp tài liệu (.docx, .pdf, .txt):
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/20 rounded-2xl p-4 text-center cursor-pointer transition-all space-y-2"
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".txt,.doc,.docx,.pdf" 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {selectedFile ? selectedFile.name : 'Nhấp để chọn tệp hoặc kéo thả vào đây'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ tệp văn bản Word, PDF, Text</p>
                  </div>
                </div>
              </div>

              {/* Textarea Input */}
              <div className="space-y-1.5">
                <label htmlFor="audit-text-input" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Hoặc dán nội dung văn bản cần rà soát:</span>
                  <span className="text-[10px] text-slate-400 font-normal">{documentText.length} ký tự</span>
                </label>
                <textarea
                  id="audit-text-input"
                  value={documentText}
                  onChange={(e) => setDocumentText(e.target.value)}
                  placeholder="Dán toàn văn bản cần kiểm tra chính tả, lỗi thể thức và từ ngữ vào đây..."
                  rows={6}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={isAuditing || (!documentText.trim() && !selectedFile)}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isAuditing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI đang rà soát văn bản...</span>
                  </>
                ) : (
                  <>
                    <FileSearch className="w-4 h-4 text-amber-300" />
                    <span>Bắt Đầu Rà Soát Toàn Diện</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Audit Dashboard & Results */}
        <div className="lg:col-span-7 space-y-6">
          {!result ? (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-400 text-xs shadow-xl border border-slate-200/90 min-h-[520px] flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-xs">
                <FileSearch className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <p className="font-black text-sm text-slate-900 uppercase tracking-wide">Chưa có kết quả rà soát</p>
                <p className="text-slate-500 leading-relaxed">
                  Hãy tải lên tệp hoặc dán nội dung văn bản ở cột bên trái và bấm <strong>"Bắt Đầu Rà Soát Toàn Diện"</strong> để AI phân tích chi tiết.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Summary Cards */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-200">
                        Đánh giá hoàn tất
                      </span>
                      <span className="text-xs font-black text-slate-900">Kết quả Rà soát Thể thức & Chính tả</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {result.auditSummary.generalAssessment}
                    </p>
                  </div>

                  {/* Score Badge */}
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 flex-shrink-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shadow-xs ${
                      result.auditSummary.overallScore >= 85 ? 'bg-emerald-600 text-white' :
                      result.auditSummary.overallScore >= 70 ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
                    }`}>
                      {result.auditSummary.overallScore}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Điểm chất lượng</div>
                      <div className="text-xs font-black text-slate-900">
                        {result.auditSummary.overallScore >= 85 ? 'Đạt chuẩn' : 'Cần chỉnh sửa'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-red-50/80 rounded-2xl border border-red-200 text-center space-y-0.5">
                    <div className="text-base font-black text-red-700">{result.auditSummary.totalErrors}</div>
                    <div className="text-[10px] font-bold text-red-900 uppercase">Tổng lỗi phát hiện</div>
                  </div>
                  <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 text-center space-y-0.5">
                    <div className="text-base font-black text-amber-700">{result.auditSummary.spellingErrorsCount}</div>
                    <div className="text-[10px] font-bold text-amber-900 uppercase">Lỗi chính tả</div>
                  </div>
                  <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200 text-center space-y-0.5">
                    <div className="text-base font-black text-blue-700">{result.auditSummary.formattingErrorsCount}</div>
                    <div className="text-[10px] font-bold text-blue-900 uppercase">Lỗi thể thức</div>
                  </div>
                  <div className="p-3 bg-indigo-50/80 rounded-2xl border border-indigo-200 text-center space-y-0.5">
                    <div className="text-base font-black text-indigo-700">{result.auditSummary.vocabularyErrorsCount}</div>
                    <div className="text-[10px] font-bold text-indigo-900 uppercase">Từ ngữ/Ngữ cảnh</div>
                  </div>
                </div>
              </div>

              {/* EDITABLE DOCUMENT PARAMETERS & WORK PROCESSING BOX */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 1. Editable Document Parameters */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-blue-600" />
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Thông số Văn bản (Có thể chỉnh sửa)</h3>
                    </div>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 font-bold">
                      Sẵn sàng cập nhật
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Số ký hiệu:</label>
                      <input 
                        type="text" 
                        value={docNumber} 
                        onChange={(e) => setDocNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Cơ quan ban hành:</label>
                      <input 
                        type="text" 
                        value={issuingAuthority} 
                        onChange={(e) => setIssuingAuthority(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Trích yếu nội dung:</label>
                      <input 
                        type="text" 
                        value={docSubject} 
                        onChange={(e) => setDocSubject(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Ngày ban hành:</label>
                      <input 
                        type="text" 
                        value={docDate} 
                        onChange={(e) => setDocDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Độ khẩn / Mức độ:</label>
                      <select 
                        value={urgencyLevel}
                        onChange={(e) => setUrgencyLevel(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Thường">Thường</option>
                        <option value="Khẩn">Khẩn</option>
                        <option value="Thượng khẩn">Thượng khẩn</option>
                        <option value="Hỏa tốc">Hỏa tốc</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Người ký / Chức vụ:</label>
                      <input 
                        type="text" 
                        value={signerName} 
                        onChange={(e) => setSignerName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Work Processing Notes Box */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Ô Ghi Xử lý Công việc</h3>
                      </div>
                      {processingSavedMsg && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-pulse">
                          ✓ Đã lưu xử lý
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Trạng thái xử lý:</label>
                        <select 
                          value={processingStatus}
                          onChange={(e: any) => setProcessingStatus(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="PENDING">Chờ xử lý</option>
                          <option value="IN_PROGRESS">Đang xử lý / Đôn đốc</option>
                          <option value="APPROVED">Đã trình ký phê duyệt</option>
                          <option value="COMPLETED">Đã hoàn tất ban hành</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Đơn vị / Chuyên viên thụ lý:</label>
                        <input 
                          type="text" 
                          value={assignedTo}
                          onChange={(e) => setAssignedTo(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Ý kiến chỉ đạo / Ghi chú xử lý công việc:</label>
                      <textarea
                        rows={4}
                        value={workNotes}
                        onChange={(e) => setWorkNotes(e.target.value)}
                        placeholder="Nhập ý kiến chỉ đạo của lãnh đạo, hướng dẫn nghiệp vụ hoặc ghi chú tiến độ xử lý công việc..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      onClick={handleSaveProcessingNotes}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 cursor-pointer active:scale-95"
                    >
                      <Save className="w-4 h-4" />
                      <span>Lưu thông tin xử lý</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs Navigation for Audit Details */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('errors')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'errors'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      🔍 Chi tiết Lỗi ({result.errorsAndIssues.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('paragraphs')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'paragraphs'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      ✍️ Gợi ý Viết lại Câu ({result.paragraphSuggestions.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('polished')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'polished'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      ✨ Toàn văn Hoàn thiện
                    </button>
                    <button
                      onClick={() => setActiveTab('diff')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'diff'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      🔄 So sánh (Diff)
                    </button>
                  </div>

                  {activeTab === 'errors' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Lọc lỗi:</span>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold rounded-xl px-2.5 py-1 focus:outline-none"
                      >
                        <option value="ALL">Tất cả loại lỗi</option>
                        <option value="SPELLING">Chính tả</option>
                        <option value="FORMAT">Thể thức</option>
                        <option value="VOCABULARY">Từ ngữ</option>
                        <option value="STYLE">Văn phong</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* TAB 1: ERRORS & ISSUES LIST */}
                {activeTab === 'errors' && (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {filteredErrors.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        Không có lỗi nào phù hợp với bộ lọc hiện tại.
                      </div>
                    ) : (
                      filteredErrors.map(item => (
                        <div key={item.id} className="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl space-y-2.5 transition-all">
                          <div className="flex items-center justify-between">
                            <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg border ${
                              item.type === 'SPELLING' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              item.type === 'FORMAT' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              item.type === 'VOCABULARY' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                              'bg-purple-50 text-purple-800 border-purple-200'
                            }`}>
                              {item.type === 'SPELLING' ? 'Lỗi Chính tả' :
                               item.type === 'FORMAT' ? 'Lỗi Thể thức' :
                               item.type === 'VOCABULARY' ? 'Từ ngữ chưa chuẩn' : 'Văn phong'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">ID: {item.id}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-red-50/60 border border-red-200/80 rounded-xl space-y-1">
                              <span className="text-[10px] font-black text-red-700 uppercase">Phát hiện gốc:</span>
                              <p className="text-xs font-semibold text-slate-900 line-through decoration-red-500/60">
                                "{item.originalText}"
                              </p>
                              <p className="text-[11px] text-red-800 font-medium">{item.issueDescription}</p>
                            </div>

                            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1">
                              <span className="text-[10px] font-black text-emerald-800 uppercase flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Đề xuất sửa lại:</span>
                              </span>
                              <p className="text-xs font-bold text-slate-900">
                                "{item.suggestedFix}"
                              </p>
                              <p className="text-[11px] text-slate-600 italic">💡 {item.explanation}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 2: PARAGRAPH SUGGESTIONS */}
                {activeTab === 'paragraphs' && (
                  <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                    {result.paragraphSuggestions.map((para, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                            Gợi ý cải thiện #{idx + 1}
                          </span>
                          <span className="text-[11px] text-slate-600 font-semibold">{para.reason}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Đoạn gốc:</span>
                            <p className="italic">"{para.originalParagraph}"</p>
                          </div>

                          <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs text-indigo-950 font-medium leading-relaxed space-y-1">
                            <span className="text-[10px] font-bold text-indigo-700 uppercase block">Đoạn đã gọt giũa chuẩn mực:</span>
                            <p className="font-semibold">"{para.improvedParagraph}"</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: FULLY AUDITED & POLISHED DOCUMENT */}
                {activeTab === 'polished' && (
                  <div className="space-y-4">
                    <div className="text-xs leading-relaxed text-slate-900 font-normal whitespace-pre-line bg-slate-50 p-5 rounded-2xl border border-slate-200 min-h-[340px] max-h-[440px] overflow-y-auto leading-relaxed shadow-inner">
                      {result.fullyAuditedDocument}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Đã chuẩn hóa theo quy định hành chính</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyToClipboard(result.fullyAuditedDocument, 'polished')}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                        >
                          {copiedText === 'polished' ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Đã sao chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Sao chép toàn văn</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleDownloadFile}
                          className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-blue-200 cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Tải về tệp .TXT</span>
                        </button>

                        <button
                          onClick={handleSaveToNotebook}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                        >
                          <BookmarkPlus className="w-4 h-4" />
                          <span>Lưu Sổ Tay Nhật Ký</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: DIFF CHECKER VIEW */}
                {activeTab === 'diff' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <GitCompare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-xs font-bold text-slate-800">So sánh Khác biệt giữa Gốc và Hoàn thiện</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDiffMode('inline')}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                            diffMode === 'inline' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          So sánh Dòng/Từ (Inline)
                        </button>
                        <button
                          onClick={() => setDiffMode('sidebyside')}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                            diffMode === 'sidebyside' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Song song (Side-by-Side)
                        </button>
                      </div>
                    </div>

                    {diffMode === 'inline' ? (
                      <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl min-h-[360px] max-h-[440px] overflow-y-auto text-xs font-mono leading-relaxed whitespace-pre-wrap">
                        <div className="mb-3 pb-2 border-b border-slate-200 text-[11px] font-sans font-bold text-slate-500 flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1.5 text-red-700 bg-red-100 px-2.5 py-1 rounded-lg border border-red-200">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span> Văn bản gốc (Đã xóa/sửa)
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Văn bản mới (Được thêm/hoàn thiện)
                          </span>
                        </div>
                        <div className="leading-loose">
                          {Diff.diffWords(documentText || '[Không có văn bản gốc]', result.fullyAuditedDocument).map((part, index) => {
                            const bgClass = part.added 
                              ? 'bg-emerald-100 text-emerald-950 font-bold px-1.5 py-0.5 rounded mx-0.5 inline-block my-0.5 border border-emerald-300' 
                              : part.removed 
                              ? 'bg-red-100 text-red-900 line-through px-1.5 py-0.5 rounded mx-0.5 inline-block my-0.5 border border-red-300' 
                              : 'text-slate-800';
                            return (
                              <span key={index} className={bgClass}>
                                {part.value}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold text-red-700 uppercase flex items-center gap-1.5 px-1">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                            <span>Phiên bản Gốc trước Rà soát</span>
                          </div>
                          <div className="p-4 bg-red-50/40 border border-red-200/80 rounded-2xl text-xs font-mono text-slate-800 min-h-[340px] max-h-[420px] overflow-y-auto whitespace-pre-line leading-relaxed">
                            {documentText || '[Chưa có nội dung văn bản gốc]'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[11px] font-bold text-emerald-700 uppercase flex items-center gap-1.5 px-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                            <span>Phiên bản Chuẩn hóa (Sau Rà soát)</span>
                          </div>
                          <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl text-xs font-mono text-slate-900 font-medium min-h-[340px] max-h-[420px] overflow-y-auto whitespace-pre-line leading-relaxed">
                            {result.fullyAuditedDocument}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
