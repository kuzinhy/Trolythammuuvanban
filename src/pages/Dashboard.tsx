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

    // Check if Google Drive access token is available in current session
    getAccessToken().then(token => {
      if (isMounted) setHasDriveToken(!!token);
    });

    // Realtime listener with limit to keep memory & parsing footprint minimal
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

  // Compute stats in a single memoized pass
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
    setUploadStep('Đang tiếp nhận tệp tin...');

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

      setUploadStep('Trợ lý AI đang thẩm định & đồng thời tải lên Google Drive...');

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

      setUploadStep('Đang lập hồ sơ văn bản...');

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
    <div className="max-w-6xl mx-auto space-y-8 pb-12 font-sans">
      {/* Modern Royal Blue Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-6 md:p-7 text-white border border-blue-700/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-950/70 text-blue-200 border border-blue-700/80 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Văn phòng Tham mưu Cấp ủy
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-blue-950/70 text-blue-200 border border-blue-700/80 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-blue-300" />
              Drive Sync Active
            </span>
          </div>
          <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
            Trung tâm Tiếp nhận & Tham mưu Văn bản
          </h1>
          <p className="text-xs text-blue-100/90 max-w-2xl leading-relaxed font-normal">
            Hệ thống ứng dụng AI Gemini tự động thẩm định văn bản, đề xuất phương án phân luồng (Ban Thường vụ / UBND / Đơn vị), đồng bộ Google Drive và khởi tạo Phiếu Trình điện tử.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/documents"
            className="px-3.5 py-2 bg-blue-800/80 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors border border-blue-600/60 flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-blue-200" />
            <span>Sổ Văn bản</span>
          </Link>
          <Link
            to="/tasks"
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đôn đốc Nhiệm vụ</span>
          </Link>
        </div>
      </div>

      {/* Task Deadline Reminder Alert Banner */}
      <TaskReminderAlertBanner tasks={allTasks} documents={allDocs} />

      {/* Flat Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="w-11 h-11 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-700 font-bold">
            <FileText className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng văn bản</div>
            <div className="text-2xl font-bold text-slate-900 leading-none mt-1">{stats.totalDocs}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 text-indigo-600 font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trình Ban Thường vụ</div>
            <div className="text-2xl font-bold text-indigo-600 leading-none mt-1">{stats.standingBoardDocs}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="w-11 h-11 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-center flex-shrink-0 text-sky-600 font-bold">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lưu Google Drive</div>
            <div className="text-2xl font-bold text-sky-600 leading-none mt-1">{stats.driveSyncedDocs}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-600 font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhiệm vụ đôn đốc</div>
            <div className="text-2xl font-bold text-slate-900 leading-none mt-1">{stats.pendingTasks}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & Recent Dispatches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upload Dropzone & Google Drive Connection Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Upload Box */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 space-y-4">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Tiếp nhận & Thẩm định Văn bản</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Kéo thả công văn, tờ trình, nghị quyết (PDF/DOCX) để AI tự động thẩm định và lưu vào Google Drive.
              </p>
            </div>

            <div 
              {...getRootProps()} 
              className={`
                border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-colors duration-150
                ${isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center space-y-3">
                {isUploading ? (
                  <div className="py-4 space-y-3">
                    <Loader2 className="w-9 h-9 text-blue-600 animate-spin mx-auto" />
                    <div className="text-xs font-bold text-slate-900">{uploadStep}</div>
                    <p className="text-[11px] text-slate-500">Đang tổng hợp thông tin thể thức & phân công...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl flex items-center justify-center">
                      <UploadCloud className="w-6 h-6 text-blue-600" />
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

          {/* Google Drive Folder Sync Banner */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-blue-600 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lưu trữ Google Drive</h3>
                  <p className="text-[11px] text-slate-500">Tự động đồng bộ tệp gốc khi tải lên</p>
                </div>
              </div>
              
              {hasDriveToken ? (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã kết nối
                </span>
              ) : (
                <button
                  onClick={handleConnectDrive}
                  disabled={isConnectingDrive}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                  title="Nhấp để cấp quyền tự động tải lên Google Drive"
                >
                  {isConnectingDrive ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>Kích hoạt Drive</span>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {hasDriveToken 
                ? "Phiên làm việc đã kích hoạt Google Drive. Mọi văn bản bạn tải lên sẽ tự động lưu trữ song song và đính kèm đường link gốc."
                : "Để hệ thống tự động tải tệp PDF/DOCX lên Google Drive cơ quan hoặc Drive cá nhân, bạn có thể nhấp 'Kích hoạt Drive'."}
            </p>

            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <a
                href={TARGET_DRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 group"
              >
                <span>Mở Thư mục Drive</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
              </a>

              {!hasDriveToken && (
                <button
                  onClick={handleConnectDrive}
                  disabled={isConnectingDrive}
                  className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnectingDrive ? 'animate-spin' : ''}`} />
                  <span>Cấp quyền Drive</span>
                </button>
              )}
            </div>
          </div>

          {/* AI Features Checklist */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quy trình thẩm định tự động</h3>
            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Trích xuất chính xác số hiệu, trích yếu, ngày ký, độ khẩn/mật.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Thẩm định phân luồng: Ban Thường vụ, Thường trực hay UBND.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <span>Xác định đơn vị chủ trì, đơn vị phối hợp tham mưu.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
                <span>Lập sẵn Phiếu Trình điện tử & Dự thảo công văn chỉ đạo.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Dispatches & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Documents Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Văn bản Mới Tiếp Nhận & Phân Luồng</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Danh sách văn bản đã được thẩm định tự động & đồng bộ</p>
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
                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-600 group-hover:text-blue-600 transition-colors">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-slate-900">
                            {doc.documentNumber || 'Số: Đang cập nhật'}
                          </span>
                          {doc.proposedAction && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-bold rounded truncate max-w-[220px]">
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
                          {doc.issuer ? `Cơ quan gửi: ${doc.issuer}` : doc.fileName}
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

          {/* Recent Tasks List */}
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Nhiệm vụ Chỉ Đạo Gần Đây</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Tiến độ thực hiện nhiệm vụ bóc tách từ văn bản</p>
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
                  <div key={task.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{task.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {task.assignedOrganization && (
                          <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                            {task.assignedOrganization}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="text-blue-700 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" /> Hạn: {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                      task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-700'
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
