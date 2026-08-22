import { useCallback, useState, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, FileText, AlertCircle, Loader2, CheckCircle2, 
  Clock, ChevronRight, ShieldAlert, Building2, Sparkles, 
  ExternalLink, HardDrive, FileCheck, RefreshCw
} from 'lucide-react';
import { useNavigate, Link } from 'react-router';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, getAccessToken, requestDriveAccess } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { Document, Task } from '../types';
import { TaskReminderToasts, TaskReminderAlertBanner } from '../components/TaskReminderToasts';

const TARGET_DRIVE_FOLDER_ID = '1XqI-PetoZDvUiGEDiqnT25-4t1qonbIY';
const TARGET_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${TARGET_DRIVE_FOLDER_ID}`;

export default function Dashboard() {
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

  const stats = useMemo(() => {
    let urgent = 0;
    let standingBoard = 0;
    let driveCount = 0;

    for (const doc of allDocs) {
      if (doc.urgency && doc.urgency !== 'Thường') urgent++;
      if (doc.proposedAction && (doc.proposedAction.includes('Ban Thường vụ') || doc.proposedAction.includes('Thường trực'))) {
        standingBoard++;
      }
      if (doc.driveFileId || doc.driveUrl) {
        driveCount++;
      }
    }

    let pending = 0;
    let completed = 0;

    for (const task of allTasks) {
      if (task.status === 'COMPLETED') completed++;
      else pending++;
    }

    return {
      totalDocs: allDocs.length,
      urgentDocs: urgent,
      standingBoardDocs: standingBoard,
      driveSyncedDocs: driveCount,
      pendingTasks: pending,
      completedTasks: completed,
    };
  }, [allDocs, allTasks]);

  const recentDocs = useMemo(() => allDocs.slice(0, 6), [allDocs]);
  const recentTasks = useMemo(() => allTasks.slice(0, 5), [allTasks]);

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
          const tokenRes = await fetch("/_system/workspace/token");
          if (tokenRes.ok) {
            const data = await tokenRes.json();
            workspaceToken = data.token;
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

      const uploadRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: workspaceToken ? { 'Authorization': `Bearer ${workspaceToken}` } : {},
        body: formData,
      });

      const data = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(data.error || 'Tải lên và phân tích văn bản thất bại');

      setUploadStep('Đang lưu trữ hồ sơ dịch vụ công...');

      const docRef = await addDoc(collection(db, 'documents'), {
        ...data.analysis,
        driveFileId: data.driveFileId || null,
        driveUrl: data.driveUrl || (data.driveFileId ? `https://drive.google.com/file/d/${data.driveFileId}/view` : null),
        driveFolderId: data.driveFolderId || customFolderId || TARGET_DRIVE_FOLDER_ID,
        driveFolderUrl: data.driveFolderUrl || TARGET_DRIVE_FOLDER_URL,
        fileName: data.fileName || file.name,
        mimeType: data.mimeType || file.type,
        status: 'ANALYZED',
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
      });

      navigate(`/documents/${docRef.id}`);

    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi tải lên');
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  }, [navigate, user, customFolderId]);

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
      {/* Government Digital Service Portal Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-6 text-white border border-blue-700/60 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-blue-950/80 text-blue-200 border border-blue-600/60 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Cổng Dịch vụ công & Điều hành Điện tử Cấp ủy
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold uppercase tracking-wider">
                Phiên bản V2.5 Chuyên nghiệp
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Hệ thống Tiếp nhận, Thẩm định & Điều hành Văn bản Thông minh
            </h1>
            <p className="text-xs text-blue-100 max-w-2xl leading-relaxed">
              Cung cấp giải pháp số hóa toàn diện thủ tục hành chính Đảng, tự động hóa trích xuất công văn, đôn đốc nhiệm vụ trọng tâm và trợ lý ảo điều hành 24/7 dành cho Thường trực và Văn phòng Cấp ủy.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <Link
              to="/documents"
              className="px-4 py-2.5 bg-blue-800/90 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all border border-blue-600/70 flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>Sổ Văn bản đến</span>
            </Link>
            <Link
              to="/tasks"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Nhiệm vụ đôn đốc</span>
            </Link>
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
                AI Chief of Staff
              </span>
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Đã chuyển sang phân hệ độc lập cao cấp
              </span>
            </div>
            <h2 className="text-base font-black text-white uppercase tracking-wide mt-0.5">
              Trung tâm Trợ lý Ảo Chánh Văn phòng (Mở giao diện đầy đủ)
            </h2>
            <p className="text-xs text-blue-200/80">Nhấn vào đây để truy cập không gian tham mưu chuyên sâu, báo cáo điều hành AI và quản lý điểm nóng</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center group-hover:translate-x-1 transition-transform flex-shrink-0 shadow-md">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>

      {/* Main Grid: Upload & Recent Dispatches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upload Dropzone & Google Drive Connection Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Upload Box */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
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
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Văn bản Mới Tiếp Nhận & Phân Luồng</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Danh sách hồ sơ công văn đã thẩm định tự động</p>
              </div>
              <Link to="/documents" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <span>Xem tất cả</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {recentDocs.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  Chưa có văn bản nào trong hệ thống. Hãy kéo thả văn bản ở trên để bắt đầu!
                </div>
              ) : (
                recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="p-4 hover:bg-slate-50/80 cursor-pointer transition-colors flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-slate-900">
                            {doc.documentNumber || 'Số: Đang cập nhật'}
                          </span>
                          {doc.proposedAction && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100 truncate max-w-[200px]">
                              {doc.proposedAction}
                            </span>
                          )}
                          {doc.leadDepartment && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded truncate max-w-[150px]">
                              Chủ trì: {doc.leadDepartment}
                            </span>
                          )}
                          {(doc.driveFileId || doc.driveUrl) && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded flex items-center gap-1">
                              <HardDrive className="w-2.5 h-2.5" />
                              Drive
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                          {doc.title || doc.fileName}
                        </h4>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {doc.issuer ? `Cơ quan ban hành: ${doc.issuer}` : doc.fileName}
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
