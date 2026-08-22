import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, getAccessToken, requestDriveAccess } from '../lib/firebase';
import { 
  FileText, Loader2, Sparkles, Check, CheckSquare, Printer, 
  ArrowLeft, Clock, ShieldCheck, Building2, Edit3, Save, RotateCcw, BrainCircuit,
  Scale, FileSignature, AlertCircle, ExternalLink, HardDrive, UploadCloud, Tag, Plus, X, Bell
} from 'lucide-react';
import { Document, Task } from '../types';
import DispatchSlip from '../components/DispatchSlip';
import DraftGenerator from '../components/DraftGenerator';
import { getDocumentProgressStatus } from './DocumentList';
import { getDocumentTags, getTagStyle, STANDARD_TAGS } from '../lib/tagUtils';
import { getActiveLearningRules, saveLearnedAdjustmentRule, matchTextAgainstLearnedRules, type LearningRule } from '../lib/learningEngine';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [docTags, setDocTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagSelector, setShowTagSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Tasks
  const [extractingTasks, setExtractingTasks] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<Task[] | null>(null);
  
  // Modals
  const [showDispatchSlip, setShowDispatchSlip] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  
  // Active Tab
  const [activeTab, setActiveTab] = useState<'advisory' | 'tasks' | 'original' | 'legal'>('advisory');

  // AI Learning & Interactive Adjustment States
  const [isEditingProposal, setIsEditingProposal] = useState(false);
  const [editLeadDept, setEditLeadDept] = useState('');
  const [editCoordinating, setEditCoordinating] = useState('');
  const [editAction, setEditAction] = useState('');
  const [editOpinion, setEditOpinion] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editDocType, setEditDocType] = useState('Văn bản chỉ đạo');
  const [isSavingAiRule, setIsSavingAiRule] = useState(false);
  const [matchedLearnedRule, setMatchedLearnedRule] = useState<LearningRule | null>(null);
  const [learningNotification, setLearningNotification] = useState<string | null>(null);

  // AI Summary States
  const [summarizingDoc, setSummarizingDoc] = useState(false);
  const [documentSummary, setDocumentSummary] = useState<{
    executiveSummary: string;
    keyPoints: string[];
    urgencyAssessment: string;
    suggestedActions: string;
  } | null>(null);

  // Reminder & Deadline Settings States
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3);
  const [reminderNotes, setReminderNotes] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchDoc = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'documents', id));
        if (docSnap.exists()) {
          const fetchedData = { id: docSnap.id, ...docSnap.data() } as Document;
          setDocument(fetchedData);
          setDocTags(getDocumentTags(fetchedData));

          // Set initial form values for editing
          setEditLeadDept(fetchedData.leadDepartment || '');
          setEditCoordinating(fetchedData.coordinatingDepartments?.join(', ') || '');
          setEditAction(fetchedData.proposedAction || '');
          setEditOpinion(fetchedData.advisoryOpinion || '');
          setEditDeadline(fetchedData.actionDeadline || '');
          setEditDocType(fetchedData.documentType || 'Văn bản chỉ đạo');
          setReminderEnabled(fetchedData.reminderEnabled ?? true);
          setReminderDaysBefore(fetchedData.reminderDaysBefore ?? 3);
          setReminderNotes(fetchedData.reminderNotes || '');

          // Check if document matches any learned rule
          const rules = await getActiveLearningRules();
          const docText = `${fetchedData.title} ${fetchedData.summary || ''} ${fetchedData.proposedAction || ''}`;
          const ruleMatch = matchTextAgainstLearnedRules(docText, rules);
          if (ruleMatch) {
            setMatchedLearnedRule(ruleMatch);
          }
        }
      } catch (err) {
        console.error("Error fetching doc", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id]);

  const handleStartEditProposal = () => {
    if (!document) return;
    setEditLeadDept(document.leadDepartment || '');
    setEditCoordinating(document.coordinatingDepartments?.join(', ') || '');
    setEditAction(document.proposedAction || '');
    setEditOpinion(document.advisoryOpinion || '');
    setEditDeadline(document.actionDeadline || '');
    setEditDocType(document.documentType || 'Văn bản chỉ đạo');
    setIsEditingProposal(true);
  };

  const handleSaveAndTrainAi = async () => {
    if (!id || !document) return;
    setIsSavingAiRule(true);
    setLearningNotification(null);

    const coordArray = editCoordinating
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const updatedDocData = {
      leadDepartment: editLeadDept,
      coordinatingDepartments: coordArray,
      proposedAction: editAction,
      advisoryOpinion: editOpinion,
      actionDeadline: editDeadline,
      documentType: editDocType,
    };

    try {
      // 1. Update document in Firestore
      await updateDoc(doc(db, 'documents', id), updatedDocData);
      setDocument(prev => prev ? { ...prev, ...updatedDocData } : null);

      // 2. Extract key trigger terms for AI learning
      const rawTriggers = [
        document.title,
        ...docTags,
        document.documentType
      ].filter(Boolean).join(' ');

      const keywordList = Array.from(new Set(
        rawTriggers
          .replace(/[^\w\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/gi, ' ')
          .split(/\s+/)
          .filter(w => w.length > 3)
          .slice(0, 4)
      )).join(', ');

      const triggerStr = keywordList || document.title.slice(0, 30);

      // 3. Save new AI Learning Rule
      const savedRule = await saveLearnedAdjustmentRule({
        keywordTrigger: triggerStr,
        suggestedLeadDept: editLeadDept,
        suggestedAction: editAction,
        suggestedCoordinating: coordArray,
        learnedAt: new Date().toLocaleDateString('vi-VN'),
        confidence: 98,
        useCount: 1,
        isActive: true,
        notes: `Học từ sự điều chỉnh phương án xử lý của Lãnh đạo cho VB số ${document.documentNumber || document.title.slice(0, 20)}`
      });

      setMatchedLearnedRule(savedRule);
      setIsEditingProposal(false);
      setLearningNotification(`Đã lưu phương án mới & Huấn luyện AI thành công! Từ nay hệ thống sẽ tự động giao "${editLeadDept}" khi phát hiện văn bản có tính chất tương tự.`);

      setTimeout(() => {
        setLearningNotification(null);
      }, 8000);
    } catch (err) {
      console.error("Error saving proposal & training AI:", err);
      alert('Có lỗi xảy ra khi lưu phương án xử lý.');
    } finally {
      setIsSavingAiRule(false);
    }
  };

  const handleAddTag = async (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed || !id || !document) return;
    if (docTags.includes(trimmed)) return;

    const updatedTags = [...docTags, trimmed];
    setDocTags(updatedTags);
    setNewTagInput('');
    setShowTagSelector(false);

    try {
      await updateDoc(doc(db, 'documents', id), { tags: updatedTags });
      setDocument(prev => prev ? { ...prev, tags: updatedTags } : null);
    } catch (e) {
      console.error("Error updating tags:", e);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!id || !document) return;
    const updatedTags = docTags.filter(t => t !== tagToRemove);
    setDocTags(updatedTags);

    try {
      await updateDoc(doc(db, 'documents', id), { tags: updatedTags });
      setDocument(prev => prev ? { ...prev, tags: updatedTags } : null);
    } catch (e) {
      console.error("Error removing tag:", e);
    }
  };

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

  const handleGenerateAiSummary = async () => {
    if (!document) return;
    try {
      setSummarizingDoc(true);
      const res = await fetch('/api/summarize-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentData: document })
      });
      const data = await res.json();
      if (res.ok) {
        setDocumentSummary(data);
      } else {
        alert(data.error || 'Tóm tắt văn bản thất bại.');
      }
    } catch (err: any) {
      console.error('Error summarizing document:', err);
      alert('Lỗi kết nối khi gọi AI tóm tắt văn bản.');
    } finally {
      setSummarizingDoc(false);
    }
  };

  const handleSaveReminder = async () => {
    if (!id || !document) return;
    try {
      setSavingReminder(true);
      const updateData = {
        actionDeadline: editDeadline,
        reminderEnabled,
        reminderDaysBefore,
        reminderNotes
      };
      await updateDoc(doc(db, 'documents', id), updateData);
      setDocument(prev => prev ? { ...prev, ...updateData } : null);
      alert('Đã cập nhật deadline và cấu hình thông báo nhắc nhở thành công!');
    } catch (err) {
      console.error('Error saving reminder:', err);
      alert('Lỗi khi lưu cấu hình nhắc nhở.');
    } finally {
      setSavingReminder(false);
    }
  };

  const autoSyncToDriveIfNeeded = async () => {
    if (!document || !id || document.driveFileId) return;
    try {
      const token = await getAccessToken();
      if (!token) return;

      const contentSummary = `VĂN BẢN: ${document.title || document.fileName}
Số hiệu: ${document.documentNumber || 'N/A'}
Cơ quan ban hành: ${document.issuer || document.leadDepartment || 'N/A'}
Ngày ban hành: ${document.issuedDate || 'N/A'}
Trích yếu: ${document.summary || 'N/A'}
Đề xuất xử lý: ${document.proposedAction || 'N/A'}
Nội dung chi tiết: ${document.fullContent || document.summary || ''}`;

      const blob = new Blob([contentSummary], { type: 'text/plain;charset=utf-8' });
      const fileName = `${document.documentNumber ? document.documentNumber.replace(/[\/\\]/g, '_') + '_' : ''}${document.fileName || 'van_ban_chi_dao.txt'}`;
      const file = new File([blob], fileName, { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceToken', token);

      const res = await fetch('/api/drive/sync-file', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.driveFileId) {
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
          driveFolderId: data.driveFolderId || null,
          driveFolderUrl: data.driveFolderUrl || null,
        } : null);
      }
    } catch (err) {
      console.warn('Auto sync to drive error:', err);
    }
  };

  const handleExtractTasks = async () => {
    if (!document) return;
    setExtractingTasks(true);
    try {
      // Simultaneously upload/sync to Google Drive if not already synced
      await autoSyncToDriveIfNeeded();

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
            {/* AI Document Executive Summary Card */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 p-6 rounded-2xl text-white shadow-lg space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-800/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white shadow-md">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">Tóm tắt Thông minh & Trích xuất Ý chính (Gemini AI)</h3>
                    <p className="text-xs text-indigo-200/80 mt-0.5">Tự động phân tích nội dung cốt lõi, đánh giá mức độ khẩn cấp và đề xuất hướng xử lý</p>
                  </div>
                </div>

                <button
                  onClick={handleGenerateAiSummary}
                  disabled={summarizingDoc}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer flex-shrink-0"
                >
                  {summarizingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI đang phân tích & tóm tắt...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>{documentSummary ? 'Tóm tắt lại bằng AI' : '🤖 Tạo Tóm tắt AI ngay'}</span>
                    </>
                  )}
                </button>
              </div>

              {documentSummary && (
                <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 space-y-2">
                    <div className="text-[11px] font-extrabold uppercase text-indigo-300 tracking-wider">Tóm tắt cốt lõi (Executive Summary):</div>
                    <p className="text-xs text-white leading-relaxed font-medium">{documentSummary.executiveSummary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 space-y-2">
                      <div className="text-[11px] font-extrabold uppercase text-blue-300 tracking-wider">Các điểm trọng tâm (Key Points):</div>
                      <ul className="space-y-1.5 text-xs text-indigo-100 list-disc list-inside">
                        {documentSummary.keyPoints?.map((pt, idx) => (
                          <li key={idx} className="leading-relaxed">{pt}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 space-y-1">
                        <div className="text-[11px] font-extrabold uppercase text-amber-300 tracking-wider">Đánh giá tính cấp bách:</div>
                        <p className="text-xs text-amber-100 font-semibold">{documentSummary.urgencyAssessment}</p>
                      </div>

                      <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 space-y-1">
                        <div className="text-[11px] font-extrabold uppercase text-emerald-300 tracking-wider">Đề xuất hướng xử lý:</div>
                        <p className="text-xs text-emerald-100 font-medium">{documentSummary.suggestedActions}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!documentSummary && !summarizingDoc && (
                <div className="text-center py-6 text-indigo-200/70 text-xs italic">
                  Nhấp vào nút <strong className="text-white">"🤖 Tạo Tóm tắt AI ngay"</strong> ở góc trên để AI tự động bóc tách và tóm tắt văn bản.
                </div>
              )}
            </div>

            {/* Proactive Deadline & Reminder Configuration Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase">Cài đặt Hạn Xử Lý & Thông Báo Nhắc Nhở Chủ Động</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Hệ thống sẽ tự động hiển thị thông báo toast & cảnh báo trên dashboard khi đến hạn</p>
                  </div>
                </div>

                <button
                  onClick={handleSaveReminder}
                  disabled={savingReminder}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {savingReminder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Lưu Cấu Hình Nhắc Nhở</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hạn xử lý văn bản (DD/MM/YYYY)
                  </label>
                  <input
                    type="text"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    placeholder="VD: 30/08/2026"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cảnh báo trước (Số ngày)
                  </label>
                  <select
                    value={reminderDaysBefore}
                    onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    <option value={1}>Nhắc trước 1 ngày</option>
                    <option value={3}>Nhắc trước 3 ngày (Mặc định)</option>
                    <option value={5}>Nhắc trước 5 ngày</option>
                    <option value={7}>Nhắc trước 7 ngày</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(e) => setReminderEnabled(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-800">Bật hệ thống nhắc nhở tự động</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú / Chỉ đạo nhắc nhở riêng cho văn bản này
                </label>
                <input
                  type="text"
                  value={reminderNotes}
                  onChange={(e) => setReminderNotes(e.target.value)}
                  placeholder="VD: Lưu ý đôn đốc Ban Tổ chức và Văn phòng gửi báo cáo trước hạn..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tags / Categorization Section */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>Thẻ Phân Loại Nghiệp Vụ & Phục Vụ Tìm Kiếm (Tags)</span>
                </div>
                <button
                  onClick={() => setShowTagSelector(!showTagSelector)}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Gắn thêm Tag</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {docTags.map((t) => {
                  const style = getTagStyle(t);
                  return (
                    <span
                      key={t}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border shadow-2xs transition-all ${style.bgClass}`}
                    >
                      <span>{style.icon}</span>
                      <span>{t}</span>
                      <button
                        onClick={() => handleRemoveTag(t)}
                        className="ml-1 hover:text-red-600 p-0.5 rounded-full hover:bg-black/5"
                        title="Xóa tag này"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                {docTags.length === 0 && (
                  <span className="text-xs text-slate-400 italic">Chưa có tag nào được gắn. Nhấp "Gắn thêm Tag" để phân loại.</span>
                )}
              </div>

              {/* Tag selector dropdown */}
              {showTagSelector && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <select
                      className="w-full sm:flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddTag(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>-- Chọn tag nghiệp vụ chuẩn để thêm nhanh --</option>
                      {STANDARD_TAGS.filter(st => !docTags.includes(st)).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>

                    <div className="w-full sm:w-auto flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Hoặc nhập tag mới..."
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag(newTagInput);
                          }
                        }}
                        className="flex-1 sm:w-40 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTag(newTagInput)}
                        disabled={!newTagInput.trim()}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                      >
                        Thêm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Learning Toast / Banner */}
            {learningNotification && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                <BrainCircuit className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-emerald-950">Đã cập nhật tri thức cho Hệ thống AI!</div>
                  <p className="mt-0.5 leading-relaxed">{learningNotification}</p>
                </div>
                <button 
                  onClick={() => setLearningNotification(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Key Advisory Routing Block */}
            <div className="p-5 rounded-xl bg-blue-50/40 border border-blue-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                    <BrainCircuit className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                      <span>Đề Xuất Phân Luồng & Thẩm Quyền Xử Lý (AI Trợ Lý Tham Mưu)</span>
                    </div>
                    {matchedLearnedRule && (
                      <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Áp dụng quy tắc AI đã học từ phản hồi trước (Khớp từ khóa: "{matchedLearnedRule.keywordTrigger}")</span>
                      </div>
                    )}
                  </div>
                </div>

                {!isEditingProposal ? (
                  <button
                    onClick={handleStartEditProposal}
                    className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-300 rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Điều chỉnh phương án & Huấn luyện AI</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditingProposal(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleSaveAndTrainAi}
                      disabled={isSavingAiRule}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingAiRule ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang huấn luyện AI...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu & Huấn luyện AI</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {!isEditingProposal ? (
                /* Display Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                      <div className="text-[11px] font-bold uppercase text-slate-400">Tiến độ phải xong</div>
                      <div className="text-sm font-bold text-blue-700 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span>{document.actionDeadline || 'Theo quy chế làm việc'}</span>
                      </div>
                      {document && (
                        <div className="pt-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${getDocumentProgressStatus(document).badgeClass}`}>
                            {getDocumentProgressStatus(document).label}
                          </span>
                        </div>
                      )}
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
              ) : (
                /* Interactive Edit Form Mode */
                <div className="p-4 bg-white rounded-xl border-2 border-blue-400 shadow-md space-y-4 animate-in fade-in duration-150">
                  <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      Sự điều chỉnh của Quý Lãnh đạo/Chuyên viên bên dưới sẽ được <strong>máy học ghi nhớ tự động</strong> để phân luồng chính xác hơn cho các văn bản sau này.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Thể loại / Phân loại văn bản
                      </label>
                      <select
                        value={editDocType}
                        onChange={(e) => setEditDocType(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                      >
                        <option value="Văn bản chỉ đạo">Văn bản chỉ đạo</option>
                        <option value="Thông báo">Thông báo</option>
                        <option value="Báo cáo">Báo cáo</option>
                        <option value="Quyết định">Quyết định</option>
                        <option value="Nghị quyết">Nghị quyết</option>
                        <option value="Kế hoạch">Kế hoạch</option>
                        <option value="Tờ trình">Tờ trình</option>
                        <option value="Công văn">Công văn</option>
                        <option value="Chỉ thị">Chỉ thị</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Cơ quan / Đơn vị chủ trì
                      </label>
                      <input
                        type="text"
                        value={editLeadDept}
                        onChange={(e) => setEditLeadDept(e.target.value)}
                        placeholder="VD: Đội Trật tự Đô thị & Công an Phường..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Các đơn vị phối hợp (ngăn cách dấu phẩy)
                      </label>
                      <input
                        type="text"
                        value={editCoordinating}
                        onChange={(e) => setEditCoordinating(e.target.value)}
                        placeholder="VD: Công an Phường, Đoàn Thanh niên..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Hướng phân luồng xử lý chính
                      </label>
                      <input
                        type="text"
                        value={editAction}
                        onChange={(e) => setEditAction(e.target.value)}
                        placeholder="VD: Giao Đội Trật tự Đô thị kiểm tra dứt điểm và báo cáo UBND..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-blue-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Hạn hoàn thành / Tiến độ (DD/MM/YYYY)
                      </label>
                      <input
                        type="text"
                        value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)}
                        placeholder="VD: 25/08/2026 hoặc Báo cáo trước ngày 30/08"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nội dung Ý kiến Tham mưu chi tiết trình Lãnh đạo
                    </label>
                    <textarea
                      rows={3}
                      value={editOpinion}
                      onChange={(e) => setEditOpinion(e.target.value)}
                      placeholder="Nhập nội dung ý kiến tham mưu chi tiết..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    />
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
              <div className="p-5 rounded-xl bg-blue-50/30 border border-blue-200/80 shadow-2xs text-sm leading-relaxed text-slate-900 font-medium whitespace-pre-line">
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
