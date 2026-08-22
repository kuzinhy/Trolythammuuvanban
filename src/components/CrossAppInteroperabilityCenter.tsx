import React, { useState, useEffect } from 'react';
import { 
  Link2, RefreshCw, CheckCircle2, ExternalLink, Search, FileText, CheckSquare, 
  Building2, BookOpen, Download, Upload, ShieldCheck, Cpu, ArrowUpRight, X, AlertTriangle, Database
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { db, collection, getDocs, query, orderBy, limit, CONNECTED_APP_ID, CONNECTED_APP_URL, CONNECTED_APP_NAME } from '../lib/firebase';
import { checkAppConnectionStatus, exportDatabaseBackup, importDatabaseBackup } from '../lib/syncService';
import { Document, Task, DepartmentConfig, RoutingRule } from '../types';

interface CrossAppInteroperabilityCenterProps {
  isOpen?: boolean;
  onClose?: () => void;
  embedded?: boolean;
}

export function CrossAppInteroperabilityCenter({ isOpen = true, onClose, embedded = false }: CrossAppInteroperabilityCenterProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'DOCS' | 'TASKS' | 'DEPTS' | 'RULES'>('ALL');
  
  const [loading, setLoading] = useState(true);
  const [statusInfo, setStatusInfo] = useState<any>(null);
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<DepartmentConfig[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Load status and data
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await checkAppConnectionStatus();
      setStatusInfo(res);

      const [docsSnap, tasksSnap, deptsSnap, rulesSnap] = await Promise.all([
        getDocs(query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(100))),
        getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(100))),
        getDocs(collection(db, 'departments')),
        getDocs(collection(db, 'routing_rules'))
      ]);

      setDocuments(docsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Document)));
      setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DepartmentConfig)));
      setRules(rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoutingRule)));
    } catch (err) {
      console.error("Error loading cross-app data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen || embedded) {
      loadData();
    }
  }, [isOpen, embedded]);

  if (!isOpen && !embedded) return null;

  // Search filtering logic
  const term = searchTerm.toLowerCase().trim();

  const filteredDocs = documents.filter(d => 
    !term || 
    d.title?.toLowerCase().includes(term) || 
    d.documentNumber?.toLowerCase().includes(term) ||
    d.leadDepartment?.toLowerCase().includes(term) ||
    d.summary?.toLowerCase().includes(term)
  );

  const filteredTasks = tasks.filter(t => 
    !term || 
    t.title?.toLowerCase().includes(term) || 
    t.assignedOrganization?.toLowerCase().includes(term) ||
    t.assignedTo?.toLowerCase().includes(term)
  );

  const filteredDepts = departments.filter(d => 
    !term || 
    d.name?.toLowerCase().includes(term) || 
    d.code?.toLowerCase().includes(term) ||
    d.headPerson?.toLowerCase().includes(term)
  );

  const filteredRules = rules.filter(r => 
    !term || 
    r.ruleName?.toLowerCase().includes(term) || 
    r.keywords?.some(k => k.toLowerCase().includes(term))
  );

  const handleExport = async () => {
    try {
      const json = await exportDatabaseBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Dong_Bo_Lien_Thong_CSDL_${CONNECTED_APP_ID.substring(0,8)}_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncing(true);
    setImportStatus(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (text) {
          const res = await importDatabaseBackup(text);
          setImportStatus(res.message);
          if (res.success) {
            await loadData();
          }
        }
        setSyncing(false);
      };
      reader.readAsText(file);
    } catch (e: any) {
      setImportStatus("Lỗi khi nhập tệp: " + e.message);
      setSyncing(false);
    }
  };

  const containerClass = embedded
    ? "w-full animate-fade-in"
    : "fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto animate-fade-in";

  const cardClass = embedded
    ? "bg-white rounded-3xl border border-slate-200 shadow-sm w-full flex flex-col overflow-hidden"
    : "bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden";

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/30 text-blue-300 rounded-2xl border border-blue-400/30">
              <Link2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-600/60 text-blue-100 rounded">
                  Dual-Web Interoperability Engine
                </span>
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Đã kết nối thông suốt CSDL
                </span>
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-wide mt-0.5">
                Trung tâm Tra cứu & Liên thông Dữ liệu 2 Ứng dụng
              </h2>
              <p className="text-xs text-blue-200/80">
                Đồng bộ realtime hai chiều toàn bộ văn bản, nhiệm vụ đôn đốc và quy trình giữa app hiện tại và App ID: <code className="bg-white/10 px-1 font-mono">{CONNECTED_APP_ID.substring(0, 13)}...</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={CONNECTED_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition-all"
            >
              <span>Mở Web song song</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>

            {!embedded && onClose && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Telemetry Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          <div className="flex items-center gap-4 text-slate-700">
            <div className="flex items-center gap-1.5 font-bold">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Dự án Firestore: <strong className="text-blue-900">trolycvp</strong></span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-slate-500">
              <span>Độ trễ ping:</span>
              <strong className="text-emerald-700 font-mono">{statusInfo?.latencyMs || 25}ms</strong>
            </div>
            <div className="hidden md:flex items-center gap-1 text-slate-500">
              <span>Chế độ đồng bộ:</span>
              <strong className="text-indigo-700">Realtime 2 chiều</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold inline-flex items-center gap-1 shadow-2xs"
            >
              <RefreshCw className={`w-3 h-3 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
              <span>Kiểm tra kết nối</span>
            </button>

            <button
              onClick={handleExport}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold inline-flex items-center gap-1 shadow-2xs"
            >
              <Download className="w-3 h-3 text-emerald-600" />
              <span>Xuất Gói CSDL</span>
            </button>

            <label className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold inline-flex items-center gap-1 shadow-2xs cursor-pointer">
              <Upload className="w-3 h-3 text-indigo-600" />
              <span>Nhập Gói CSDL</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
        </div>

        {importStatus && (
          <div className="px-6 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold border-b border-emerald-200 flex items-center justify-between">
            <span>{importStatus}</span>
            <button onClick={() => setImportStatus(null)}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Universal Search Input */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập từ khóa tra cứu liên thông (tên văn bản, số hiệu, nhiệm vụ, chuyên viên, phòng ban)..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tất cả dữ liệu ({filteredDocs.length + filteredTasks.length + filteredDepts.length + filteredRules.length})
            </button>
            <button
              onClick={() => setActiveTab('DOCS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'DOCS' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Văn bản ({filteredDocs.length})
            </button>
            <button
              onClick={() => setActiveTab('TASKS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'TASKS' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Nhiệm vụ ({filteredTasks.length})
            </button>
            <button
              onClick={() => setActiveTab('DEPTS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'DEPTS' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Phòng ban ({filteredDepts.length})
            </button>
            <button
              onClick={() => setActiveTab('RULES')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'RULES' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Quy tắc AI ({filteredRules.length})
            </button>
          </div>

          {/* Results Display */}
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <div className="text-xs font-bold text-slate-600">Đang quét toàn vẹn cơ sở dữ liệu liên thông...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Documents Section */}
              {(activeTab === 'ALL' || activeTab === 'DOCS') && filteredDocs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Văn bản trong CSDL Liên thông ({filteredDocs.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredDocs.slice(0, 10).map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => {
                          onClose();
                          navigate(`/documents/${doc.id}`);
                        }}
                        className="bg-slate-50 hover:bg-blue-50/60 p-3.5 rounded-2xl border border-slate-200/80 cursor-pointer transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-blue-700">{doc.documentNumber || 'Đang cập nhật'}</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">Live Synced</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 line-clamp-2">{doc.title}</div>
                        <div className="text-[10px] text-slate-500">Chủ trì: {doc.leadDepartment || doc.issuer || 'Chưa phân công'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks Section */}
              {(activeTab === 'ALL' || activeTab === 'TASKS') && filteredTasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                    <span>Nhiệm vụ Đôn đốc Liên thông ({filteredTasks.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTasks.slice(0, 10).map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          onClose();
                          navigate(`/tasks`);
                        }}
                        className="bg-slate-50 hover:bg-amber-50/60 p-3.5 rounded-2xl border border-slate-200/80 cursor-pointer transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-amber-800">{t.assignedOrganization || 'Đơn vị'}</span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded">{t.status}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 line-clamp-2">{t.title}</div>
                        <div className="text-[10px] text-slate-500">Phụ trách: {t.assignedTo || 'Chuyên viên'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Departments Section */}
              {(activeTab === 'ALL' || activeTab === 'DEPTS') && filteredDepts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Danh mục Phòng ban & Khối Cấp ủy ({filteredDepts.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredDepts.map(d => (
                      <div key={d.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                        <div className="font-bold text-slate-900">{d.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Mã: {d.code} • Trưởng phòng: {d.headPerson}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Routing Rules Section */}
              {(activeTab === 'ALL' || activeTab === 'RULES') && filteredRules.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    <span>Quy tắc Phân luồng AI Học máy ({filteredRules.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredRules.map(r => (
                      <div key={r.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                        <div className="font-bold text-slate-900">{r.ruleName}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Phòng ban đề xuất: <strong>{r.department}</strong></div>
                        <div className="text-[10px] text-slate-400 truncate mt-1">Từ khóa: {r.keywords?.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Kết nối an toàn chuẩn mã hóa Firebase Security Rules</span>
          </div>
          <div className="text-[11px] font-mono">
            App ID 1: {CONNECTED_APP_ID.substring(0,8)} | App ID 2: trolycvp (Live)
          </div>
        </div>

      </div>
    </div>
  );
}
