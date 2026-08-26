import { useCallback, useState, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, FileText, AlertCircle, Loader2, CheckCircle2, 
  Clock, ChevronRight, ShieldAlert, Building2, Sparkles, 
  ExternalLink, HardDrive, FileCheck, RefreshCw, Award, Star, Brain, ArrowRight
} from 'lucide-react';
import { useNavigate, Link } from 'react-router';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, getAccessToken, requestDriveAccess, setCachedAccessToken } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useWardStore } from '../store/wardStore';
import { Document, Task } from '../types';
import { isUrgentDocument, isDocumentCompleted } from '../lib/documentUtils';
import { TaskReminderToasts, TaskReminderAlertBanner } from '../components/TaskReminderToasts';
import ImportantDocumentsSection from '../components/ImportantDocumentsSection';
import BrainTrainingModal from '../components/BrainTrainingModal';
import { safeFetchJson } from '../lib/safeFetch';
import { getContributorProfile, DAILY_SCENARIOS_BANK } from '../lib/learningEngine';

const TARGET_DRIVE_FOLDER_ID = '1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR';
const TARGET_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${TARGET_DRIVE_FOLDER_ID}`;

export default function Dashboard() {
  const [isBrainModalOpen, setIsBrainModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [hasDriveToken, setHasDriveToken] = useState<boolean>(false);
  const [customFolderId] = useState<string>(TARGET_DRIVE_FOLDER_ID);
  const [isConnectingDrive, setIsConnectingDrive] = useState<boolean>(false);
  
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { getActiveWard, activeWardId } = useWardStore();
  const activeWard = getActiveWard();

  useEffect(() => {
    let isMounted = true;

    getAccessToken().then(token => {
      if (isMounted) setHasDriveToken(!!token);
    });

    const qDocs = query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribeDocs = onSnapshot(qDocs, (snapshot) => {
      if (!isMounted) return;
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Document));
      setAllDocs(docs);
    }, (err) => console.error("Docs realtime sync error:", err));

    const qTasks = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      if (!isMounted) return;
      const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setAllTasks(tasks);
    }, (err) => console.error("Tasks realtime sync error:", err));

    return () => {
      isMounted = false;
      unsubscribeDocs();
      unsubscribeTasks();
    };
  }, []);

  // Filter documents and tasks according to active Ward selection
  const visibleDocs = useMemo(() => {
    if (activeWardId === 'all') return allDocs;
    return allDocs.filter(d => !d.wardId || d.wardId === activeWardId);
  }, [allDocs, activeWardId]);

  const visibleTasks = useMemo(() => {
    if (activeWardId === 'all') return allTasks;
    return allTasks.filter(t => !t.wardId || t.wardId === activeWardId);
  }, [allTasks, activeWardId]);

  const stats = useMemo(() => {
    let urgent = 0;
    let standingBoard = 0;
    let driveCount = 0;

    for (const doc of visibleDocs) {
      if (isUrgentDocument(doc)) urgent++;
      if (doc.proposedAction && (doc.proposedAction.includes('Ban Thường vụ') || doc.proposedAction.includes('Thường trực'))) {
        standingBoard++;
      }
      if (doc.driveFileId || doc.driveUrl) {
        driveCount++;
      }
    }

    let pending = 0;
    let completed = 0;

    for (const task of visibleTasks) {
      if (task.status === 'COMPLETED') completed++;
      else pending++;
    }

    return {
      totalDocs: visibleDocs.length,
      urgentDocs: urgent,
      standingBoardDocs: standingBoard,
      driveSyncedDocs: driveCount,
      pendingTasks: pending,
      completedTasks: completed,
    };
  }, [visibleDocs, visibleTasks]);

  const [recentDocFilter, setRecentDocFilter] = useState<'ALL' | 'STANDING_BOARD' | 'URGENT' | 'DRIVE'>('ALL');

  const filteredRecentDocs = useMemo(() => {
    let filtered = visibleDocs;
    if (recentDocFilter === 'STANDING_BOARD') {
      filtered = filtered.filter(d => d.proposedAction?.includes('Ban Thường vụ') || d.proposedAction?.includes('Thường trực'));
    } else if (recentDocFilter === 'URGENT') {
      filtered = filtered.filter(d => d.urgency && d.urgency !== 'Thường');
    } else if (recentDocFilter === 'DRIVE') {
      filtered = filtered.filter(d => d.driveFileId || d.driveUrl);
    }
    return filtered.slice(0, 7);
  }, [visibleDocs, recentDocFilter]);

  const recentTasks = useMemo(() => visibleTasks.slice(0, 5), [visibleTasks]);

  const handleConnectDrive = useCallback(async () => {
    setIsConnectingDrive(true);
    try {
      const token = await requestDriveAccess();
      if (token) {
        setHasDriveToken(true);
      }
    } catch (e) {
      console.error("Drive connection error:", e);
    } finally {
      setIsConnectingDrive(false);
    }
  }, []);

  const onDrop = useCallback(async (acceptedFiles: any[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadStep('Đang tiếp nhận tệp tin văn bản...');

    try {
      let workspaceToken: string | null = await getAccessToken();

      if (!workspaceToken) {
        try {
          const tokenRes = await safeFetchJson("/_system/workspace/token");
          if (tokenRes.ok && tokenRes.data) {
            workspaceToken = tokenRes.data.token;
          }
        } catch (e) {
          console.warn("Workspace system token lookup:", e);
        }
      }

      setUploadStep('Cổng dịch vụ công đang thẩm định AI & đồng bộ Google Drive...');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', customFolderId || TARGET_DRIVE_FOLDER_ID);
      if (workspaceToken) {
        formData.append('workspaceToken', workspaceToken);
      }

      const uploadRes = await safeFetchJson('/api/analyze', {
        method: 'POST',
        headers: workspaceToken ? { 'Authorization': `Bearer ${workspaceToken}` } : {},
        body: formData,
      });

      if (!uploadRes.ok || !uploadRes.data) {
        throw new Error(uploadRes.error || 'Tải lên và phân tích văn bản thất bại');
      }
      const data = uploadRes.data;

      if (data.isDriveAuthError) {
        console.warn("[Drive] Drive token invalid or expired. Clearing cached token.");
        setCachedAccessToken(null);
      }

      setUploadStep('Đang lưu trữ hồ sơ dịch vụ công...');

      const isAutoImportant = (
        data.analysis?.urgency === 'HOA_TOC' || 
        data.analysis?.urgency === 'THUONG_KHAN' || 
        (data.analysis?.urgency || '').toLowerCase().includes('khẩn') || 
        (data.analysis?.urgency || '').toLowerCase().includes('hỏa tốc') ||
        (data.analysis?.proposedAction || '').includes('Ban Thường vụ') || 
        (data.analysis?.proposedAction || '').includes('Thường trực') ||
        false
      );

      const docRef = await addDoc(collection(db, 'documents'), {
        ...data.analysis,
        wardId: activeWard?.id || 'phu-cuong',
        wardName: activeWard?.name || 'Đảng ủy Phường Phú Cường',
        driveFileId: data.driveFileId || null,
        driveUrl: data.driveUrl || (data.driveFileId ? `https://drive.google.com/file/d/${data.driveFileId}/view` : null),
        driveFolderId: data.driveFolderId || customFolderId || TARGET_DRIVE_FOLDER_ID,
        driveFolderUrl: data.driveFolderUrl || TARGET_DRIVE_FOLDER_URL,
        fileName: data.fileName || file.name,
        mimeType: data.mimeType || file.type,
        status: 'ANALYZED',
        createdBy: user?.uid || null,
        uploadedByName: user?.displayName || user?.email?.split('@')[0] || 'Người dùng',
        uploadedByEmail: user?.email || null,
        isImportant: isAutoImportant,
        isStarred: isAutoImportant,
        createdAt: serverTimestamp(),
      });

      navigate(`/documents/${docRef.id}`);

    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi tải lên');
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  }, [navigate, user, customFolderId, activeWard]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  } as any);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 font-sans">
      {/* Government Digital Service Portal Header Banner with Google Studio Flowing Gradient Border */}
      <div className="google-studio-border google-studio-glow">
        <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 rounded-[calc(1.25rem-2px)] p-6 text-white relative overflow-hidden shadow-lg shadow-blue-500/10">
          <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/15 via-sky-300/10 to-transparent pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs backdrop-blur-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                  Cổng Dịch vụ công & Điều hành Điện tử Cấp ủy
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-400/25 text-amber-200 border border-amber-300/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 backdrop-blur-xs">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Google AI Studio V2.5
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight drop-shadow-xs">
                Hệ thống Tiếp nhận, Thẩm định & Điều hành Văn bản Thông minh
              </h1>
              <p className="text-xs text-blue-50 max-w-2xl leading-relaxed font-medium">
                Cung cấp giải pháp số hóa toàn diện thủ tục hành chính Đảng, tự động hóa trích xuất công văn, đôn đốc nhiệm vụ trọng tâm và trợ lý ảo điều hành 24/7 dành cho Thường trực và Văn phòng Cấp ủy.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 flex-shrink-0">
              <Link
                to="/documents"
                className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all border border-white/30 flex items-center gap-2 shadow-xs cursor-pointer backdrop-blur-xs hover:border-white/50"
              >
                <FileText className="w-4 h-4 text-blue-100" />
                <span>Sổ Văn bản đến</span>
              </Link>
              <Link
                to="/tasks"
                className="px-4 py-2.5 bg-white hover:bg-blue-50 text-blue-800 rounded-xl text-xs font-black transition-all shadow-md shadow-black/10 flex items-center gap-2 cursor-pointer border border-white/80 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4 text-blue-700" />
                <span>Nhiệm vụ đôn đốc</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Task Deadline Reminder Alert Banner */}
      <TaskReminderAlertBanner tasks={allTasks} documents={allDocs} />

      {/* Card-based Dashboard Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng số văn bản</div>
            <div className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.totalDocs}</div>
            <div className="text-[10px] text-blue-600 font-semibold mt-1">Đã cập nhật hệ thống</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trình Thường trực</div>
            <div className="text-2xl font-black text-indigo-600 leading-none mt-1">{stats.standingBoardDocs}</div>
            <div className="text-[10px] text-indigo-600 font-semibold mt-1">Cần xin ý kiến chỉ đạo</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 bg-sky-50 border border-sky-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-all">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lưu Google Drive</div>
            <div className="text-2xl font-black text-sky-600 leading-none mt-1">{stats.driveSyncedDocs}</div>
            <div className="text-[10px] text-sky-600 font-semibold mt-1">Đã đồng bộ đám mây</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex items-center gap-4 group">
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nhiệm vụ đôn đốc</div>
            <div className="text-2xl font-black text-emerald-600 leading-none mt-1">{stats.pendingTasks}</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-1">Đang triển khai</div>
          </div>
        </div>
      </div>

      {/* AI Chief of Staff Executive Advisory Hub Link Banner */}
      <div 
        onClick={() => navigate('/ai-assistant')}
        className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 rounded-3xl text-white shadow-xl border border-blue-800/50 flex items-center justify-between cursor-pointer hover:scale-[1.005] transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-400/20 text-amber-300 rounded-2xl border border-amber-400/30">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-600/50 text-blue-200 rounded-md">
                Trợ lý Tham mưu Cấp ủy
              </span>
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Đồng bộ 100% Google Drive & Máy học
              </span>
            </div>
            <h2 className="text-base font-black text-white uppercase tracking-wide mt-0.5">
              Trung tâm Trợ lý Tham mưu Cấp ủy (Mở giao diện đầy đủ)
            </h2>
            <p className="text-xs text-blue-200/80">Nhấn vào đây để truy cập không gian tham mưu chuyên sâu, báo cáo điều hành AI và dự thảo kết luận</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center group-hover:translate-x-1 transition-transform flex-shrink-0 shadow-md">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>

      {/* HUẤN LUYỆN BỘ NÃO AI CẤP UỶ WIDGET */}
      <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-blue-500/10 rounded-3xl p-6 border border-amber-200 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-amber-200/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-600 text-white text-[10px] font-black rounded-md uppercase tracking-wider">
                  Huấn Luyện AI
                </span>
                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Cấp ủy Smart Learning
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900 mt-0.5">
                Huấn Luyện AI: {DAILY_SCENARIOS_BANK[0].title}
              </h3>
            </div>
          </div>

          <button
            onClick={() => setIsBrainModalOpen(true)}
            className="px-5 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl text-xs font-black inline-flex items-center gap-2.5 shadow-lg shadow-amber-500/25 transition-all cursor-pointer hover:scale-102 active:scale-95"
          >
            <Brain className="w-4 h-4 text-amber-100" />
            <span>Huấn luyện AI</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-8 text-xs text-slate-700 font-medium leading-relaxed">
            <p className="line-clamp-2">
              <strong>Bối cảnh tình huống:</strong> {DAILY_SCENARIOS_BANK[0].background}
            </p>
            <p className="text-[11px] text-blue-900 font-bold mt-1">
              🎯 Thẩm quyền tham mưu: {DAILY_SCENARIOS_BANK[0].defaultAiAdvice.authority}
            </p>
          </div>

          <div 
            onClick={() => setIsBrainModalOpen(true)}
            className="md:col-span-4 bg-white/90 backdrop-blur-xs p-3.5 rounded-2xl border border-amber-200 shadow-xs hover:border-amber-400 cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Trạng thái Bộ Não AI</div>
              <div className="text-xs font-black text-amber-950 group-hover:text-amber-600 transition-colors">
                Bấm vào đây để Huấn Luyện 👉
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-emerald-600">98.5%</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Độ chuẩn xác</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Brain Training Modal */}
      <BrainTrainingModal 
        isOpen={isBrainModalOpen}
        onClose={() => setIsBrainModalOpen(false)}
      />

      {/* Featured Important User-Uploaded Documents Section */}
      <ImportantDocumentsSection 
        documents={allDocs}
        onUploadClick={() => {
          const el = document.getElementById('upload-dropzone-box');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      {/* Main Grid: Upload & Recent Dispatches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upload Dropzone & Google Drive Connection Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Upload Box */}
          <div id="upload-dropzone-box" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 scroll-mt-24">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Tiếp nhận & Thẩm định Văn bản công</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Kéo thả công văn, quyết định (PDF/DOCX) để dịch vụ công tự động thẩm định và lưu kho lưu trữ.
              </p>
            </div>

            <div 
              {...getRootProps()} 
              className={`
                border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-150
                ${isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center space-y-3">
                {isUploading ? (
                  <div className="py-4 space-y-3">
                    <Loader2 className="w-9 h-9 text-blue-600 animate-spin mx-auto" />
                    <div className="text-xs font-bold text-slate-900">{uploadStep}</div>
                    <p className="text-[11px] text-slate-500">Hệ thống đang trích xuất số hiệu, trích yếu & phân loại...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-xs">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {isDragActive ? 'Thả tệp vào đây' : 'Nhấp chọn hoặc kéo thả tệp'}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        PDF, DOCX (Tối đa 15MB)
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-xs border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Google Drive Folder Sync Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lưu trữ Google Drive</h3>
                  <p className="text-[11px] text-slate-500">Đồng bộ đám mây tự động</p>
                </div>
              </div>
              
              {hasDriveToken ? (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã kết nối
                </span>
              ) : (
                <button
                  onClick={handleConnectDrive}
                  disabled={isConnectingDrive}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 shadow-xs"
                >
                  {isConnectingDrive ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>Kích hoạt Drive</span>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {hasDriveToken 
                ? "Tài khoản Google Drive đã được liên kết thành công. Tất cả văn bản tiếp nhận sẽ lưu trữ đồng bộ."
                : "Kích hoạt quyền truy cập Google Drive để lưu trữ tự động mọi công văn vào kho dữ liệu cơ quan."}
            </p>

            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <a
                href={TARGET_DRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 group"
              >
                <span>Mở Thư mục Drive</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </a>

              {!hasDriveToken && (
                <button
                  onClick={handleConnectDrive}
                  disabled={isConnectingDrive}
                  className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnectingDrive ? 'animate-spin' : ''}`} />
                  <span>Cấp quyền</span>
                </button>
              )}
            </div>
          </div>

          {/* Citizen-Centric Service Features Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tiêu chuẩn Cổng Dịch Vụ công</h3>
            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Xử lý trực tuyến nhanh chóng</div>
                  <div className="text-[11px] text-slate-500">Giảm thiểu giấy tờ, minh bạch tiến độ.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Phân luồng tự động thông minh</div>
                  <div className="text-[11px] text-slate-500">Chuyển tiếp đúng thẩm quyền lãnh đạo.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">Đôn đốc nhiệm vụ xuyên suốt</div>
                  <div className="text-[11px] text-slate-500">Cảnh báo hạn xử lý tự động qua thông báo.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Dispatches & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Documents Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Văn bản Mới Tiếp Nhận & Phân Luồng</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Danh sách hồ sơ công văn đã thẩm định tự động</p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRecentDocFilter('ALL')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    recentDocFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Tất cả ({allDocs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRecentDocFilter('STANDING_BOARD')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    recentDocFilter === 'STANDING_BOARD'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Trình BTV ({stats.standingBoardDocs})
                </button>
                <button
                  type="button"
                  onClick={() => setRecentDocFilter('URGENT')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    recentDocFilter === 'URGENT'
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Khẩn ({stats.urgentDocs})
                </button>
                <button
                  type="button"
                  onClick={() => setRecentDocFilter('DRIVE')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    recentDocFilter === 'DRIVE'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Drive ({stats.driveSyncedDocs})
                </button>
                
                <Link to="/documents" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 ml-1">
                  <span>Toàn bộ</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredRecentDocs.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  Không có văn bản nào phù hợp với bộ lọc đã chọn.
                </div>
              ) : (
                filteredRecentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="p-3.5 sm:p-4 hover:bg-blue-50/40 cursor-pointer transition-colors flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-2xs">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-[11px] font-black text-slate-900">
                            {doc.documentNumber || 'Số: Đang cập nhật'}
                          </span>
                          {doc.urgency && doc.urgency !== 'Thường' && (
                            <span className="px-1.5 py-0.2 bg-red-100 text-red-800 text-[9px] font-black rounded border border-red-200">
                              {doc.urgency}
                            </span>
                          )}
                          {doc.proposedAction && (
                            <span className="px-2 py-0.2 bg-blue-50 text-blue-800 text-[10px] font-bold rounded border border-blue-100 truncate max-w-[200px]">
                              {doc.proposedAction}
                            </span>
                          )}
                          {doc.leadDepartment && (
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-medium rounded truncate max-w-[150px]">
                              Chủ trì: {doc.leadDepartment}
                            </span>
                          )}
                          {(doc.driveFileId || doc.driveUrl) && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded flex items-center gap-1">
                              <HardDrive className="w-2.5 h-2.5" />
                              Drive
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                          {doc.title || doc.fileName}
                        </h4>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 truncate">
                          <span>{doc.issuer ? `Cơ quan: ${doc.issuer}` : doc.fileName}</span>
                          {doc.actionDeadline && (
                            <span className="text-blue-600 font-semibold">• Hạn: {doc.actionDeadline}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Tasks Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Nhiệm vụ Chỉ Đạo Gần Đây</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Tiến độ thực hiện nhiệm vụ đôn đốc các cơ quan</p>
              </div>
              <Link to="/tasks" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <span>Xem bảng Kanban</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentTasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Chưa có nhiệm vụ nào được ghi nhận.
                </div>
              ) : (
                recentTasks.map((task) => (
                  <div key={task.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{task.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {task.assignedOrganization && (
                          <span className="font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                            {task.assignedOrganization}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="text-slate-600 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" /> Hạn: {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                      task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {task.status === 'COMPLETED' ? 'Hoàn thành' : task.status === 'IN_PROGRESS' ? 'Đang thực hiện' : 'Cần xử lý'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toast Reminders Overlay Widget */}
      <TaskReminderToasts tasks={allTasks} documents={allDocs} />
    </div>
  );
}
