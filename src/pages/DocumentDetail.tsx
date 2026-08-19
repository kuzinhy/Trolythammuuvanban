import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, getAccessToken, requestDriveAccess } from '../lib/firebase';
import { 
  FileText, Loader2, Sparkles, Check, CheckSquare, Printer, 
  ArrowLeft, Clock, ShieldCheck, Building2, 
  Scale, FileSignature, AlertCircle, ExternalLink, HardDrive, UploadCloud
} from 'lucide-react';
import { Document, Task } from '../types';
import DispatchSlip from '../components/DispatchSlip';
import DraftGenerator from '../components/DraftGenerator';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Tasks
  const [extractingTasks, setExtractingTasks] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<Task[] | null>(null);
  
  // Modals
  const [showDispatchSlip, setShowDispatchSlip] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  
  // Active Tab
  const [activeTab, setActiveTab] = useState<'advisory' | 'tasks' | 'original' | 'legal'>('advisory');

  useEffect(() => {
    if (!id) return;
    const fetchDoc = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'documents', id));
        if (docSnap.exists()) {
          setDocument({ id: docSnap.id, ...docSnap.data() } as Document);
        }
      } catch (err) {
        console.error("Error fetching doc", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id]);

  const handleManualDriveSync = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !document || !id) return;

    setIsSyncingDrive(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await requestDriveAccess();
      }
      if (!token) {
        alert('Cần cấp quyền truy cập Google Drive để tiếp tục đồng bộ.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceToken', token);

      const res = await fetch('/api/drive/sync-file', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đồng bộ Google Drive thất bại');
      }

      // Update Firestore document
      await updateDoc(doc(db, 'documents', id), {
        driveFileId: data.driveFileId,
        driveUrl: data.driveUrl,
        driveFolderId: data.driveFolderId || null,
        driveFolderUrl: data.driveFolderUrl || null,
      });

      setDocument(prev => prev ? {
        ...prev,
        driveFileId: data.driveFileId,
        driveUrl: data.driveUrl,
        driveFolderId: data.driveFolderId,
        driveFolderUrl: data.driveFolderUrl,
      } : null);

      alert('Đã đồng bộ tệp lên Google Drive thành công!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Lỗi khi đồng bộ lên Google Drive');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleExtractTasks = async () => {
    if (!document) return;
    setExtractingTasks(true);
    try {
      const res = await fetch('/api/extract-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: document })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Trích xuất nhiệm vụ thất bại do hệ thống AI đang bận. Vui lòng thử lại sau.');
        return;
      }
      setExtractedTasks(data.tasks || []);
      setActiveTab('tasks');
    } catch (e: any) {
      console.error(e);
      alert('Có lỗi xảy ra khi trích xuất nhiệm vụ. Vui lòng thử lại.');
    } finally {
      setExtractingTasks(false);
    }
  };

  const handleConfirmTask = async (index: number) => {
    if (!extractedTasks || !document) return;
    const taskToConfirm = extractedTasks[index];
    
    try {
      const docRef = await addDoc(collection(db, 'tasks'), {
        ...taskToConfirm,
        sourceDocumentId: document.id,
        sourceDocumentNumber: document.documentNumber || null,
        sourceDocumentTitle: document.title || document.fileName,
        approvalStatus: 'CONFIRMED',
        createdAt: serverTimestamp(),
        status: 'PENDING'
      });
      
      const updated = [...extractedTasks];
      updated[index].approvalStatus = 'CONFIRMED';
      updated[index].id = docRef.id;
      setExtractedTasks(updated);
    } catch (e) {
      console.error('Error adding task: ', e);
    }
  };

  const handleConfirmAllTasks = async () => {
    if (!extractedTasks || !document) return;
    for (let i = 0; i < extractedTasks.length; i++) {
      if (extractedTasks[i].approvalStatus !== 'CONFIRMED') {
        await handleConfirmTask(i);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs text-slate-500 font-medium">Đang tải hồ sơ văn bản...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="max-w-xl mx-auto text-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm mt-8">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Không tìm thấy hồ sơ văn bản</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">Văn bản này không tồn tại hoặc bạn không có quyền truy cập.</p>
        <Link to="/documents" className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const driveViewUrl = document.driveUrl || (document.driveFileId ? `https://drive.google.com/file/d/${document.driveFileId}/view` : null);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 font-sans">
      {/* Top Breadcrumb & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <button 
            onClick={() => navigate('/documents')} 
            className="flex items-center gap-1 text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kho văn bản</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-bold truncate max-w-sm">
            {document.documentNumber || document.title || document.fileName}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowDispatchSlip(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
            title="In hoặc xuất Phiếu trình xử lý văn bản"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Phiếu Trình Văn bản</span>
          </button>

          <button
            onClick={() => setShowDraftModal(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            title="Tạo dự thảo văn bản chỉ đạo hoặc thông báo kết luận"
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>Soạn Dự Thảo Chỉ Đạo</span>
          </button>

          <button
            onClick={handleExtractTasks}
            disabled={extractingTasks}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
          >
            {extractingTasks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
            <span>Bóc Tách Nhiệm Vụ</span>
          </button>
        </div>
      </div>

      {/* Main Document Summary Card */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Banner Header */}
        <div className="p-6 md:p-8 border-b border-slate-100/80 bg-gradient-to-r from-blue-50/40 via-white to-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-400/30 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 text-white">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase rounded-lg tracking-wider border border-blue-200/80">
                  {document.documentType || 'Văn bản'}
                </span>
                {document.documentNumber && (
                  <span className="px-2.5 py-0.5 bg-slate-200/80 text-slate-800 text-[10px] font-bold uppercase rounded-lg">
                    Số: {document.documentNumber}
                  </span>
                )}
                {document.urgency && document.urgency !== 'Thường' && (
                  <span className="px-2.5 py-0.5 bg-sky-100 text-sky-800 text-[10px] font-extrabold uppercase rounded-lg border border-sky-200">
                    {document.urgency}
                  </span>
                )}
                {document.confidentiality && document.confidentiality !== 'Thường' && (
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase rounded-lg border border-indigo-200">
                    {document.confidentiality}
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-950 leading-snug">
                {document.title || document.fileName}
              </h1>
              <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500 font-medium">
                {document.issuer && (
                  <span>Cơ quan ban hành: <strong className="text-slate-700">{document.issuer}</strong></span>
                )}
                {document.issuedDate && (
                  <span>Ngày ban hành: <strong className="text-slate-700">{document.issuedDate}</strong></span>
                )}
                {document.signer && (
                  <span>Người ký: <strong className="text-slate-700">{document.signer}</strong></span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 self-start md:self-center">
            {driveViewUrl ? (
              <a 
                href={driveViewUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-3.5 py-2 bg-blue-50/90 hover:bg-blue-600 hover:text-white border border-blue-200 text-blue-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all group"
                title="Mở tệp văn bản gốc trên Google Drive"
              >
                <HardDrive className="w-4 h-4 text-blue-600 group-hover:text-white transition-colors" />
                <span>Xem bản gốc Drive</span>
                <ExternalLink className="w-3.5 h-3.5 text-blue-400 group-hover:text-white transition-colors" />
              </a>
            ) : (
              <div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf,.doc,.docx"
                  onChange={handleManualDriveSync}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSyncingDrive}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
                  title="Tải tệp gốc lên Google Drive để lưu trữ"
                >
                  {isSyncingDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 text-amber-600" />}
                  <span>Đồng bộ lên Drive</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200/80 bg-white/70 backdrop-blur-md px-6">
          <button
            onClick={() => setActiveTab('advisory')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'advisory'
                ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Tham Mưu & Phân Luồng</span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'tasks'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Ma Trận Nhiệm Vụ</span>
            {extractedTasks && (
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px]">
                {extractedTasks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('legal')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'legal'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Căn Cứ Pháp Lý & Viện Dẫn</span>
          </button>

          {driveViewUrl && (
            <button
              onClick={() => setActiveTab('original')}
              className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'original'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Xem Văn Bản Gốc</span>
            </button>
          )}
        </div>

        {/* Tab 1: Advisory & Routing */}
        {activeTab === 'advisory' && (
          <div className="p-6 md:p-8 space-y-6">
            {/* Key Advisory Routing Block */}
            <div className="p-5 rounded-xl bg-blue-50/40 border border-blue-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-900">
                  <Sparkles className="w-4 h-4 text-sky-500" />
                  <span>Đề Xuất Phân Luồng & Thẩm Quyền Xử Lý (AI Tham Mưu)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium italic">Tự động tổng hợp theo quy định</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-white rounded-xl border border-blue-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Hướng phân luồng chính</div>
                  <div className="text-sm font-bold text-blue-700">
                    {document.proposedAction || 'Báo cáo Lãnh đạo cho chủ trương'}
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Cơ quan chủ trì tham mưu</div>
                  <div className="text-sm font-bold text-slate-900">
                    {document.leadDepartment || 'Văn phòng Cấp ủy / UBND'}
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Hạn xử lý đề xuất</div>
                  <div className="text-sm font-bold text-blue-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>{document.actionDeadline || 'Theo quy chế làm việc'}</span>
                  </div>
                </div>
              </div>

              {document.coordinatingDepartments && document.coordinatingDepartments.length > 0 && (
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-start gap-2 text-xs text-slate-700">
                  <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900">Đơn vị phối hợp tham mưu: </strong>
                    <span>{document.coordinatingDepartments.join(', ')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Advisory Draft Opinion */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ý Kiến Tham Mưu Chi Tiết Trình Lãnh Đạo
                </h3>
              </div>
              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs text-sm leading-relaxed text-slate-800 font-serif italic whitespace-pre-line">
                "{document.advisoryOpinion || document.summary || 'Kính trình Lãnh đạo xem xét cho ý kiến chỉ đạo triển khai thực hiện.'}"
              </div>
            </div>

            {/* Document Summary & Key Directives */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tóm Tắt Nội Dung Văn Bản</h3>
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-700 min-h-[140px]">
                  {document.summary || 'Không có tóm tắt chi tiết.'}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Các Chỉ Đạo Cốt Lõi / Yêu Cầu Trọng Tâm</h3>
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 min-h-[140px]">
                  {document.keyDirectives && document.keyDirectives.length > 0 ? (
                    <ul className="space-y-2 list-disc pl-4">
                      {document.keyDirectives.map((d, i) => (
                        <li key={i} className="leading-snug">{d}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400 italic">Không có chỉ đạo đặc biệt nào.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Extracted Full Content & Keyword Index for Search */}
            {(document.fullContent || (document.extractedTextKeywords && document.extractedTextKeywords.length > 0)) && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Dữ Liệu Toàn Văn & Chỉ Mục Từ Khóa Phục Vụ Tra Cứu</span>
                  </h3>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                    Đã chỉ mục Firestore
                  </span>
                </div>

                {document.extractedTextKeywords && document.extractedTextKeywords.length > 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Từ khóa chỉ mục:</span>
                    {document.extractedTextKeywords.map((kw, idx) => (
                      <span key={idx} className="px-2.5 py-0.5 bg-white text-slate-700 border border-slate-200 rounded-md text-[11px] font-semibold">
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}

                {document.fullContent && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-slate-700 font-mono whitespace-pre-line max-h-48 overflow-y-auto">
                    {document.fullContent}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Task Matrix */}
        {activeTab === 'tasks' && (
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-blue-50/50 border border-blue-200">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Bóc Tách & Đôn Đốc Nhiệm Vụ Chỉ Đạo</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tự động tạo nhiệm vụ gắn với cơ quan chịu trách nhiệm và hạn hoàn thành</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExtractTasks}
                  disabled={extractingTasks}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
                >
                  {extractingTasks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{extractedTasks ? 'Phân tích lại' : 'Bắt đầu phân tích'}</span>
                </button>
                {extractedTasks && extractedTasks.length > 0 && (
                  <button
                    onClick={handleConfirmAllTasks}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Lưu tất cả vào bảng theo dõi</span>
                  </button>
                )}
              </div>
            </div>

            {extractingTasks && (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-900">Đang quét toàn văn để bóc tách nhiệm vụ...</p>
                <p className="text-xs text-slate-500 mt-1">Trích xuất cơ quan chủ trì, sản phẩm đầu ra và mốc thời hạn</p>
              </div>
            )}

            {!extractingTasks && extractedTasks && (
              <div className="space-y-3">
                {extractedTasks.map((task, idx) => (
                  <div key={idx} className="p-5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed pl-8">{task.description}</p>
                      
                      <div className="flex flex-wrap gap-2 pl-8 pt-1">
                        {task.assignedOrganization && (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            Giao cho: <strong>{task.assignedOrganization}</strong>
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-md text-[11px] font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" />
                            Hạn báo cáo: <strong>{task.dueDate}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pl-8 md:pl-0 flex-shrink-0">
                      {task.approvalStatus === 'CONFIRMED' ? (
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã lưu nhiệm vụ</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConfirmTask(idx)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Đưa vào theo dõi</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {extractedTasks.length === 0 && (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                    Không tìm thấy nhiệm vụ cụ thể nào trong văn bản này.
                  </div>
                )}
              </div>
            )}

            {!extractingTasks && !extractedTasks && (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
                <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800">Chưa tạo ma trận nhiệm vụ</h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">Nhấn nút bên dưới để AI tự động phân tích và trích xuất danh sách công việc giao các đơn vị.</p>
                <button
                  onClick={handleExtractTasks}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-sky-200" />
                  <span>Bóc tách nhiệm vụ ngay</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Legal Basis */}
        {activeTab === 'legal' && (
          <div className="p-6 md:p-8 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Căn Cứ Pháp Lý & Văn Bản Quy Phạm Viện Dẫn</h3>
              {document.legalBasis && document.legalBasis.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {document.legalBasis.map((basis, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                      <Scale className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs font-medium text-slate-800">{basis}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  Không tìm thấy căn cứ pháp lý cụ thể nào được trích dẫn trong văn bản.
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cơ Quan & Cá Nhân Liên Quan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cơ quan liên quan</div>
                  <div className="text-xs font-semibold text-slate-800">
                    {document.organizations?.length ? document.organizations.join(', ') : 'Không có'}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cá nhân liên quan</div>
                  <div className="text-xs font-semibold text-slate-800">
                    {document.persons?.length ? document.persons.join(', ') : 'Không có'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Original Document Preview */}
        {activeTab === 'original' && driveViewUrl && (
          <div className="p-6 md:p-8">
            <div className="aspect-[4/3] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <iframe 
                src={driveViewUrl.replace(/\/view.*$/, '/preview')} 
                className="w-full h-full"
                allow="autoplay"
                title="Bản gốc văn bản"
              />
            </div>
          </div>
        )}
      </div>

      {/* Dispatch Slip Modal */}
      {showDispatchSlip && (
        <DispatchSlip document={document} onClose={() => setShowDispatchSlip(false)} />
      )}

      {/* Draft Generator Modal */}
      {showDraftModal && (
        <DraftGenerator document={document} onClose={() => setShowDraftModal(false)} />
      )}
    </div>
  );
}
