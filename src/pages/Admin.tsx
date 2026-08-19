import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Settings, Users, FolderGit2, BookOpen, 
  Activity, Save, Plus, Trash2, CheckCircle2, AlertCircle, 
  HardDrive, Sparkles, RefreshCw, Lock, ArrowUpRight, Search, 
  Building2, FileText, CheckSquare, Layers, ShieldCheck, ChevronRight,
  Database, Link2, Download, Upload, Cpu, Server, Check, Clock
} from 'lucide-react';
import { useAuthStore, isSystemAdmin } from '../store/authStore';
import { DepartmentConfig, RoutingRule, LegalBasisItem, SystemConfig, AuditLog, AppConnectionConfig } from '../types';
import { 
  db, collection, getDocs, doc, setDoc, writeBatch, serverTimestamp,
  TARGET_DRIVE_FOLDER_ID, TARGET_DRIVE_FOLDER_URL, getAccessToken, requestDriveAccess,
  CONNECTED_APP_ID, CONNECTED_APP_URL, CONNECTED_APP_NAME
} from '../lib/firebase';
import { 
  checkAppConnectionStatus, exportDatabaseBackup, importDatabaseBackup, DEFAULT_APP_CONNECTION 
} from '../lib/syncService';

// Initial default configuration datasets tailored for Party & Local Government administration
const INITIAL_DEPARTMENTS: DepartmentConfig[] = [
  { id: '1', code: 'VPTU', name: 'Văn phòng Cấp ủy / Thành ủy', category: 'CAP_UY', headPerson: 'Chánh Văn phòng', keywords: ['tổng hợp', 'lịch công tác', 'thường trực', 'ban thường vụ'], isDefaultLead: true },
  { id: '2', code: 'BTCTU', name: 'Ban Tổ chức Cấp ủy', category: 'CAP_UY', headPerson: 'Trưởng Ban Tổ chức', keywords: ['cán bộ', 'quy hoạch', 'bổ nhiệm', 'kết nạp đảng', 'tổ chức cơ sở đảng'], isDefaultLead: false },
  { id: '3', code: 'BTGTU', name: 'Ban Tuyên giáo Cấp ủy', category: 'CAP_UY', headPerson: 'Trưởng Ban Tuyên giáo', keywords: ['tuyên truyền', 'báo chí', 'học tập nghị quyết', 'dư luận xã hội', 'lịch sử đảng'], isDefaultLead: false },
  { id: '4', code: 'UBKTTU', name: 'Ủy ban Kiểm tra Cấp ủy', category: 'CAP_UY', headPerson: 'Chủ nhiệm UBKT', keywords: ['kiểm tra', 'giám sát', 'kỷ luật đảng', 'khiếu nại tố cáo đảng viên'], isDefaultLead: false },
  { id: '5', code: 'VP_UBND', name: 'Văn phòng HĐND & UBND', category: 'CHINH_QUYEN', headPerson: 'Chánh Văn phòng HĐND-UBND', keywords: ['chỉ đạo điều hành', 'kinh tế xã hội', 'chủ tịch ubnd'], isDefaultLead: false },
  { id: '6', code: 'PTNMT', name: 'Phòng Tài nguyên và Môi trường', category: 'CHINH_QUYEN', headPerson: 'Trưởng phòng', keywords: ['đất đai', 'quy hoạch sử dụng đất', 'môi trường', 'thu hồi đất', 'giải phóng mặt bằng'], isDefaultLead: false },
  { id: '7', code: 'PTCKH', name: 'Phòng Tài chính - Kế hoạch', category: 'CHINH_QUYEN', headPerson: 'Trưởng phòng', keywords: ['ngân sách', 'đầu tư công', 'dự toán', 'giá đất', 'tài sản công'], isDefaultLead: false },
  { id: '8', code: 'PQLDT', name: 'Phòng Quản lý Đô thị / Kinh tế', category: 'CHINH_QUYEN', headPerson: 'Trưởng phòng', keywords: ['xây dựng', 'giao thông', 'quy hoạch đô thị', 'cấp phép xây dựng'], isDefaultLead: false },
  { id: '9', code: 'PTP', name: 'Phòng Tư pháp', category: 'CHINH_QUYEN', headPerson: 'Trưởng phòng', keywords: ['thẩm định văn bản quy phạm', 'phổ biến pháp luật', 'hộ tịch', 'xử phạt vi phạm'], isDefaultLead: false },
];

const INITIAL_ROUTING_RULES: RoutingRule[] = [
  {
    id: 'r1',
    targetAuthority: 'Báo cáo Ban Thường vụ Tỉnh ủy/Thành ủy',
    criteria: 'Nghị quyết, Chỉ thị chuyên đề, chủ trương đầu tư dự án trọng điểm, công tác quy hoạch cán bộ chủ chốt, vấn đề an ninh quốc phòng phức tạp.',
    urgencyLevel: 'THUONG_KHAN',
    suggestedLeadDept: 'Văn phòng Cấp ủy / Thành ủy',
    defaultDeadlineDays: 3,
    isActive: true,
  },
  {
    id: 'r2',
    targetAuthority: 'Trình Thường trực Cấp ủy (Bí thư, Phó Bí thư)',
    criteria: 'Công văn chỉ đạo triển khai kết luận của cấp trên, giải quyết đơn thư khiếu nại vượt cấp, công tác đối ngoại, duyệt chương trình công tác tuần/tháng.',
    urgencyLevel: 'HOA_TOC',
    suggestedLeadDept: 'Văn phòng Cấp ủy / Thành ủy',
    defaultDeadlineDays: 2,
    isActive: true,
  },
  {
    id: 'r3',
    targetAuthority: 'Chuyển UBND chỉ đạo thực hiện & Báo cáo kết quả',
    criteria: 'Văn bản của các Bộ, Ngành trung ương hoặc UBND tỉnh về chuyên môn kinh tế - xã hội, quản lý đô thị, giải ngân đầu tư công, tài chính ngân sách.',
    urgencyLevel: 'BINH_THUONG',
    suggestedLeadDept: 'Văn phòng HĐND & UBND',
    defaultDeadlineDays: 5,
    isActive: true,
  },
  {
    id: 'r4',
    targetAuthority: 'Giao Cơ quan chuyên môn chủ trì tham mưu',
    criteria: 'Văn bản xin ý kiến đóng góp dự thảo, báo cáo định kỳ ngành, hướng dẫn nghiệp vụ chuyên đề.',
    urgencyLevel: 'BINH_THUONG',
    suggestedLeadDept: 'Phòng ban chuyên môn tương ứng',
    defaultDeadlineDays: 7,
    isActive: true,
  }
];

const INITIAL_LEGAL_BASIS: LegalBasisItem[] = [
  {
    id: 'l1',
    code: 'Quy chế làm việc Cấp ủy',
    title: 'Quy chế làm việc của Ban Chấp hành, Ban Thường vụ và Thường trực',
    issuer: 'Ban Thường vụ Thành ủy',
    scope: 'Thẩm quyền & Phân công nhiệm vụ Thường trực, Ban Thường vụ',
    summary: 'Xác định rõ thẩm quyền quyết định các vấn đề kinh tế - xã hội, cán bộ, đầu tư công và an ninh trật tự.',
    validFrom: '2021-01-01',
  },
  {
    id: 'l2',
    code: 'Nghị định 30/2020/NĐ-CP',
    title: 'Nghị định về công tác văn thư và quản lý văn bản nhà nước',
    issuer: 'Chính phủ',
    scope: 'Thể thức, thẩm quyền ban hành, quy trình xử lý văn bản',
    summary: 'Quy định tiêu chuẩn lập phiếu trình, lưu trữ văn bản điện tử và ký số.',
    validFrom: '2020-03-05',
  },
  {
    id: 'l3',
    code: 'Luật Tổ chức chính quyền địa phương',
    title: 'Luật Tổ chức chính quyền địa phương (sửa đổi, bổ sung)',
    issuer: 'Quốc hội',
    scope: 'Nhiệm vụ quyền hạn HĐND và UBND các cấp',
    summary: 'Căn cứ pháp lý xác định thẩm quyền của Chủ tịch UBND và tập thể UBND.',
    validFrom: '2019-11-22',
  },
];

export default function Admin() {
  const { user } = useAuthStore();
  const isAdmin = isSystemAdmin(user);

  const [activeTab, setActiveTab] = useState<'overview' | 'database' | 'routing' | 'departments' | 'legal' | 'system'>('overview');
  
  // States with localStorage & Firestore persistence
  const [departments, setDepartments] = useState<DepartmentConfig[]>(() => {
    const saved = localStorage.getItem('trolycvp_departments');
    return saved ? JSON.parse(saved) : INITIAL_DEPARTMENTS;
  });

  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(() => {
    const saved = localStorage.getItem('trolycvp_routing_rules');
    return saved ? JSON.parse(saved) : INITIAL_ROUTING_RULES;
  });

  const [legalBasis, setLegalBasis] = useState<LegalBasisItem[]>(() => {
    const saved = localStorage.getItem('trolycvp_legal_basis');
    return saved ? JSON.parse(saved) : INITIAL_LEGAL_BASIS;
  });

  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => {
    const saved = localStorage.getItem('trolycvp_system_config');
    return saved ? JSON.parse(saved) : {
      defaultDriveFolderId: TARGET_DRIVE_FOLDER_ID,
      defaultDriveFolderName: 'Hồ sơ lưu trữ Văn bản Tham mưu',
      preferredAiModel: 'gemini-3.1-flash-lite',
      autoExtractTasksOnUpload: true,
      enableDriveAutoUpload: true,
      defaultSignerTitle: 'Chánh Văn phòng',
      organizationName: 'Văn phòng Cấp ủy & Chính quyền',
      connectedApp: DEFAULT_APP_CONNECTION
    };
  });

  const [appConnection, setAppConnection] = useState<AppConnectionConfig>(DEFAULT_APP_CONNECTION);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [connectionLatency, setConnectionLatency] = useState<number | null>(null);
  const [databaseStats, setDatabaseStats] = useState({
    documentsCount: 0,
    tasksCount: 0,
    departmentsCount: departments.length,
    rulesCount: routingRules.length,
    legalBasesCount: legalBasis.length
  });
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [officers] = useState([
    { uid: 'admin-primary', name: 'Nguyễn Huy (Quản trị viên)', email: 'nguyenhuy.thudaumot@gmail.com', role: 'ADMIN', department: 'Văn phòng Cấp ủy', status: 'Đang hoạt động' },
    { uid: 'usr-1', name: 'Chuyên viên Tổng hợp Cấp ủy', email: 'chuyenvien.capuy@vanphong.gov.vn', role: 'OFFICE', department: 'Văn phòng Cấp ủy', status: 'Đang hoạt động' },
    { uid: 'usr-2', name: 'Chuyên viên Văn thư - Lưu trữ', email: 'vanthu@vanphong.gov.vn', role: 'OFFICE', department: 'Bộ phận Văn thư', status: 'Đang hoạt động' },
    { uid: 'usr-3', name: 'Lãnh đạo Phê duyệt', email: 'lanhdao.vp@vanphong.gov.vn', role: 'LEADER', department: 'Lãnh đạo Văn phòng', status: 'Đang hoạt động' },
  ]);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [driveTestStatus, setDriveTestStatus] = useState<string | null>(null);

  // New Department Form modal/drawer state
  const [newDept, setNewDept] = useState({ code: '', name: '', category: 'CAP_UY' as const, headPerson: '', keywords: '' });
  const [showAddDept, setShowAddDept] = useState(false);

  // New Routing Rule Form state
  const [newRule, setNewRule] = useState({ targetAuthority: '', criteria: '', urgencyLevel: 'THUONG_KHAN' as const, suggestedLeadDept: 'Văn phòng Cấp ủy', defaultDeadlineDays: 3 });
  const [showAddRule, setShowAddRule] = useState(false);

  // Run initial connection test on mount
  useEffect(() => {
    runConnectionDiagnostic();
  }, []);

  const runConnectionDiagnostic = async () => {
    setIsCheckingConnection(true);
    try {
      const res = await checkAppConnectionStatus();
      setAppConnection(res.appConfig);
      setConnectionLatency(res.latencyMs);
      setDatabaseStats({
        documentsCount: res.stats.documentsCount,
        tasksCount: res.stats.tasksCount,
        departmentsCount: res.stats.departmentsCount || departments.length,
        rulesCount: res.stats.rulesCount || routingRules.length,
        legalBasesCount: res.stats.legalBasesCount || legalBasis.length
      });
    } catch (e) {
      console.error("Diagnostic error:", e);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Save changes to Firestore and localStorage
  const handleSaveAll = async () => {
    localStorage.setItem('trolycvp_departments', JSON.stringify(departments));
    localStorage.setItem('trolycvp_routing_rules', JSON.stringify(routingRules));
    localStorage.setItem('trolycvp_legal_basis', JSON.stringify(legalBasis));
    localStorage.setItem('trolycvp_system_config', JSON.stringify(systemConfig));

    // Save to Firestore collections
    try {
      await setDoc(doc(db, 'system_config', 'main'), {
        ...systemConfig,
        connectedApp: appConnection,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Batch save rules & departments
      const batch = writeBatch(db);
      departments.forEach(dept => {
        batch.set(doc(db, 'departments', dept.id), dept, { merge: true });
      });
      routingRules.forEach(rule => {
        batch.set(doc(db, 'routing_rules', rule.id), rule, { merge: true });
      });
      legalBasis.forEach(legal => {
        batch.set(doc(db, 'legal_bases', legal.id), legal, { merge: true });
      });
      await batch.commit();
    } catch (e) {
      console.warn("Could not write config to Firestore in background:", e);
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportBackupFile = async () => {
    try {
      const jsonBackup = await exportDatabaseBackup();
      const blob = new Blob([jsonBackup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trolycvp_backup_app_${CONNECTED_APP_ID.substring(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Lỗi khi xuất dữ liệu: ${e.message}`);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportStatus("Đang nhập và đồng bộ dữ liệu vào cơ sở dữ liệu...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const result = await importDatabaseBackup(text);
        setImportStatus(result.message);
        if (result.success) {
          runConnectionDiagnostic();
        }
      } catch (err: any) {
        setImportStatus(`Lỗi đọc tệp tin: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleSeedDefaults = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn đặt lại và đồng bộ dữ liệu mẫu chuẩn cho Cấp ủy & Chính quyền?")) return;
    setDepartments(INITIAL_DEPARTMENTS);
    setRoutingRules(INITIAL_ROUTING_RULES);
    setLegalBasis(INITIAL_LEGAL_BASIS);
    
    localStorage.setItem('trolycvp_departments', JSON.stringify(INITIAL_DEPARTMENTS));
    localStorage.setItem('trolycvp_routing_rules', JSON.stringify(INITIAL_ROUTING_RULES));
    localStorage.setItem('trolycvp_legal_basis', JSON.stringify(INITIAL_LEGAL_BASIS));

    try {
      const batch = writeBatch(db);
      INITIAL_DEPARTMENTS.forEach(dept => batch.set(doc(db, 'departments', dept.id), dept, { merge: true }));
      INITIAL_ROUTING_RULES.forEach(rule => batch.set(doc(db, 'routing_rules', rule.id), rule, { merge: true }));
      INITIAL_LEGAL_BASIS.forEach(legal => batch.set(doc(db, 'legal_bases', legal.id), legal, { merge: true }));
      await batch.commit();
      runConnectionDiagnostic();
      alert("Đã đồng bộ thành công dữ liệu chuẩn mẫu vào cơ sở dữ liệu!");
    } catch (e: any) {
      alert(`Lỗi cập nhật CSDL: ${e.message}`);
    }
  };

  const handleTestDrive = async () => {
    setIsTestingDrive(true);
    setDriveTestStatus(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await requestDriveAccess();
      }
      if (token) {
        setDriveTestStatus('Kết nối Google Drive thành công! Thư mục lưu trữ sẵn sàng.');
      } else {
        setDriveTestStatus('Chưa có quyền Google Drive. Vui lòng cho phép quyền trong cửa sổ popup.');
      }
    } catch (e: any) {
      setDriveTestStatus(`Lỗi kết nối: ${e.message || 'Không thể xác thực'}`);
    } finally {
      setIsTestingDrive(false);
    }
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.code || !newDept.name) return;
    const dept: DepartmentConfig = {
      id: Date.now().toString(),
      code: newDept.code.toUpperCase(),
      name: newDept.name,
      category: newDept.category,
      headPerson: newDept.headPerson || 'Trưởng phòng',
      keywords: newDept.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
      isDefaultLead: false,
    };
    setDepartments([...departments, dept]);
    setNewDept({ code: '', name: '', category: 'CAP_UY', headPerson: '', keywords: '' });
    setShowAddDept(false);
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.targetAuthority || !newRule.criteria) return;
    const rule: RoutingRule = {
      id: Date.now().toString(),
      targetAuthority: newRule.targetAuthority,
      criteria: newRule.criteria,
      urgencyLevel: newRule.urgencyLevel,
      suggestedLeadDept: newRule.suggestedLeadDept,
      defaultDeadlineDays: Number(newRule.defaultDeadlineDays) || 3,
      isActive: true,
    };
    setRoutingRules([...routingRules, rule]);
    setNewRule({ targetAuthority: '', criteria: '', urgencyLevel: 'THUONG_KHAN', suggestedLeadDept: 'Văn phòng Cấp ủy', defaultDeadlineDays: 3 });
    setShowAddRule(false);
  };

  const deleteDepartment = (id: string) => {
    setDepartments(departments.filter(d => d.id !== id));
  };

  const deleteRule = (id: string) => {
    setRoutingRules(routingRules.filter(r => r.id !== id));
  };

  const toggleRule = (id: string) => {
    setRoutingRules(routingRules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 font-sans">
      {/* Top Banner - Bright Vibrant Luminous Blue */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-500/15 border border-blue-400/30">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-10 w-80 h-80 bg-cyan-300/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/20 text-white font-extrabold text-[10px] uppercase tracking-wider backdrop-blur-md flex items-center gap-1.5 ring-1 ring-white/30">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                Trung tâm Quản trị Cấp cao
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-900/40 text-blue-100 text-[10px] font-bold tracking-wide backdrop-blur-md">
                Admin: nguyenhuy.thudaumot@gmail.com
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-100 border border-emerald-300/40 text-[10px] font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Đã liên thông CSDL ({CONNECTED_APP_ID.substring(0, 8)}...)
              </span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Cấu hình & Quản trị Hệ thống Tham mưu
            </h1>
            <p className="text-xs md:text-sm text-blue-100 max-w-2xl leading-relaxed">
              Thiết lập liên thông cơ sở dữ liệu & bộ nhớ với ứng dụng <code className="bg-white/20 px-1.5 py-0.5 rounded text-white font-mono">{CONNECTED_APP_ID}</code>, quy chuẩn phân luồng thẩm quyền và thư viện căn cứ pháp lý.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              className="px-5 py-2.5 bg-white hover:bg-blue-50 text-blue-700 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-black/10 active:scale-95 group"
            >
              <Save className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
              <span>{saveSuccess ? "Đã lưu cài đặt!" : "Lưu thay đổi"}</span>
            </button>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>Toàn bộ quy chế phân luồng, liên thông CSDL và cấu hình quản trị đã được lưu trữ thành công.</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200/80 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-2xs gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Tổng quan Giám sát</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'database'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-blue-700 font-extrabold bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/60'
          }`}
        >
          <Database className="w-4 h-4 text-blue-600" />
          <span>Liên thông CSDL & Bộ nhớ ({CONNECTED_APP_ID.substring(0, 8)})</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </button>

        <button
          onClick={() => setActiveTab('routing')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'routing'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/60'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>Quy chuẩn Phân luồng ({routingRules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'departments'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Đơn vị Chủ trì & Phối hợp ({departments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('legal')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'legal'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Thư viện Căn cứ Pháp lý ({legalBasis.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'system'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/60'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cấu hình AI & Google Drive</span>
        </button>
      </div>

      {/* TAB: DATABASE & MEMORY CONNECTION */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Main Connection Status Card */}
          <div className="bg-white/95 backdrop-blur-md p-6 md:p-8 rounded-3xl border border-blue-200/80 shadow-md space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
                  <Database className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-wide">
                      Liên thông Cơ sở Dữ liệu & Bộ nhớ Đồng bộ
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      ĐANG KẾT NỐI (ACTIVE)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Ứng dụng được kết nối liên thông trực tiếp với bộ nhớ trung tâm và cơ sở dữ liệu Firestore của ứng dụng mục tiêu.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={runConnectionDiagnostic}
                  disabled={isCheckingConnection}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingConnection ? 'animate-spin' : ''}`} />
                  <span>Kiểm tra & Đồng bộ tức thì</span>
                </button>

                <a
                  href={CONNECTED_APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <span>Mở ứng dụng gốc</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Target App Connection Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-1">
                <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">Mã Ứng dụng liên thông (App ID)</div>
                <div className="text-xs font-mono font-bold text-slate-900 truncate" title={CONNECTED_APP_ID}>
                  {CONNECTED_APP_ID}
                </div>
                <div className="text-[10px] text-blue-500 font-medium">Google AI Studio Verified</div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-1">
                <div className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">Cơ sở Dữ liệu Đám mây</div>
                <div className="text-xs font-bold text-slate-900">
                  Google Cloud Firestore
                </div>
                <div className="text-[10px] text-indigo-500 font-medium">Project: {appConnection.sharedFirestoreProject}</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                <div className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">Độ trễ truy vấn CSDL</div>
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{connectionLatency !== null ? `${connectionLatency} ms` : 'Đang đo...'}</span>
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">Truy xuất thời gian thực (Realtime)</div>
              </div>

              <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 space-y-1">
                <div className="text-[10px] font-extrabold text-sky-600 uppercase tracking-wider">Chế độ Bộ nhớ</div>
                <div className="text-xs font-bold text-slate-900">
                  Realtime Dual-Sync
                </div>
                <div className="text-[10px] text-sky-500 font-medium">Tự động đồng bộ 2 chiều</div>
              </div>
            </div>

            {/* Live Synchronized Collections Status */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Các bảng Dữ liệu & Bộ nhớ được Đồng bộ hóa (Collections)</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Văn bản (documents)</div>
                  <div className="text-xl font-black text-blue-700">{databaseStats.documentsCount}</div>
                  <div className="text-[10px] text-slate-400">Hồ sơ & Phiếu trình</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Nhiệm vụ (tasks)</div>
                  <div className="text-xl font-black text-indigo-700">{databaseStats.tasksCount}</div>
                  <div className="text-[10px] text-slate-400">Đôn đốc thực hiện</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Quy chuẩn (routing_rules)</div>
                  <div className="text-xl font-black text-amber-700">{databaseStats.rulesCount}</div>
                  <div className="text-[10px] text-slate-400">Ma trận phân luồng</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Đơn vị (departments)</div>
                  <div className="text-xl font-black text-emerald-700">{databaseStats.departmentsCount}</div>
                  <div className="text-[10px] text-slate-400">Cơ cấu ban ngành</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Căn cứ (legal_bases)</div>
                  <div className="text-xl font-black text-violet-700">{databaseStats.legalBasesCount}</div>
                  <div className="text-[10px] text-slate-400">Quy chế & Nghị định</div>
                </div>
              </div>
            </div>

            {/* Backup, Restore & Data Bridge Operations */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <span>Công cụ Xuất / Nhập & Khôi phục Dữ liệu Liên thông</span>
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleExportBackupFile}
                  className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-2xs"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Sao lưu toàn bộ CSDL (.json)</span>
                </button>

                <label className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-2xs cursor-pointer">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>Nhập dữ liệu / Khôi phục (.json)</span>
                  <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
                </label>

                <button
                  onClick={handleSeedDefaults}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  <span>Nạp lại Dữ liệu Mẫu Chuẩn Cấp ủy</span>
                </button>
              </div>

              {importStatus && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-medium">
                  {importStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW & AUDIT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-blue-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FolderGit2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quy chuẩn Phân luồng</div>
                <div className="text-2xl font-black text-slate-900">{routingRules.length} thẩm quyền</div>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-indigo-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Đơn vị tiếp nhận</div>
                <div className="text-2xl font-black text-slate-900">{departments.length} cơ quan/ban</div>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-emerald-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bộ nhớ Liên thông</div>
                <div className="text-2xl font-black text-emerald-700">Đã kết nối</div>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-sky-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lưu trữ Drive</div>
                <div className="text-2xl font-black text-sky-700">Sẵn sàng</div>
              </div>
            </div>
          </div>

          {/* Officers Table */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Danh sách Cán bộ Tham mưu & Phân quyền</h3>
                <p className="text-[11px] text-slate-500">Quản lý tài khoản cán bộ có quyền truy cập hệ thống</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-3">Họ và tên cán bộ</th>
                    <th className="pb-3">Email liên hệ</th>
                    <th className="pb-3">Đơn vị / Bộ phận</th>
                    <th className="pb-3">Vai trò</th>
                    <th className="pb-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {officers.map((officer) => (
                    <tr key={officer.uid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">
                          {officer.name.charAt(0)}
                        </div>
                        <span>{officer.name}</span>
                      </td>
                      <td className="py-3 text-slate-600 font-mono">{officer.email}</td>
                      <td className="py-3 text-slate-700">{officer.department}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          officer.role === 'ADMIN' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          officer.role === 'LEADER' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {officer.role}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {officer.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROUTING RULES */}
      {activeTab === 'routing' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Ma trận Phân luồng Thẩm quyền Cấp ủy & Chính quyền</h2>
              <p className="text-xs text-slate-500">Quy chuẩn để AI đề xuất chuyển thẩm quyền (Ban Thường vụ, Thường trực, UBND, Sở Ban Ngành)</p>
            </div>
            <button
              onClick={() => setShowAddRule(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Quy chuẩn mới</span>
            </button>
          </div>

          {/* Add Rule Form */}
          {showAddRule && (
            <form onSubmit={handleAddRule} className="bg-white/95 p-6 rounded-3xl border border-blue-200 shadow-md space-y-4 animate-in fade-in">
              <div className="text-xs font-black text-blue-900 uppercase tracking-wider">Khai báo Thẩm quyền Phân luồng Mới</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Thẩm quyền chỉ đạo / Xử lý</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Trình Ban Thường vụ Tỉnh ủy / Thành ủy"
                    value={newRule.targetAuthority}
                    onChange={e => setNewRule({ ...newRule, targetAuthority: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Đơn vị chủ trì tham mưu đề xuất</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Văn phòng Cấp ủy / Thành ủy"
                    value={newRule.suggestedLeadDept}
                    onChange={e => setNewRule({ ...newRule, suggestedLeadDept: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Điều kiện / Tiêu chí kích hoạt (AI Keyword Match)</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="VD: Nghị quyết, dự án trên 100 tỷ, công tác nhân sự, chủ trương lớn..."
                    value={newRule.criteria}
                    onChange={e => setNewRule({ ...newRule, criteria: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRule(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                >
                  Lưu Quy chuẩn
                </button>
              </div>
            </form>
          )}

          {/* Rules List */}
          <div className="grid grid-cols-1 gap-4">
            {routingRules.map((rule) => (
              <div key={rule.id} className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-2xs hover:border-blue-300 transition-all space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[10px]">
                        {rule.targetAuthority}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        rule.urgencyLevel === 'HOA_TOC' ? 'bg-red-100 text-red-700' :
                        rule.urgencyLevel === 'THUONG_KHAN' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        Thời hạn: {rule.defaultDeadlineDays} ngày
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed pt-1">{rule.criteria}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
                        rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {rule.isActive ? 'Đang kích hoạt' : 'Tạm dừng'}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>Đơn vị tham mưu: <strong>{rule.suggestedLeadDept}</strong></span>
                  <span className="text-[10px] text-blue-600">Áp dụng cho mọi văn bản đến</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Cơ cấu Đơn vị Chủ trì & Phối hợp</h2>
              <p className="text-xs text-slate-500">Danh mục cơ quan Cấp ủy, Chính quyền và các phòng ban chuyên môn</p>
            </div>
            <button
              onClick={() => setShowAddDept(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Đơn vị mới</span>
            </button>
          </div>

          {showAddDept && (
            <form onSubmit={handleAddDepartment} className="bg-white/95 p-6 rounded-3xl border border-blue-200 shadow-md space-y-4 animate-in fade-in">
              <div className="text-xs font-black text-blue-900 uppercase tracking-wider">Thêm Cơ quan / Đơn vị tiếp nhận mới</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Mã viết tắt</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: STNMT"
                    value={newDept.code}
                    onChange={e => setNewDept({ ...newDept, code: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Tên đơn vị đầy đủ</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Sở Tài nguyên và Môi trường"
                    value={newDept.name}
                    onChange={e => setNewDept({ ...newDept, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Khối trực thuộc</label>
                  <select
                    value={newDept.category}
                    onChange={e => setNewDept({ ...newDept, category: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  >
                    <option value="CAP_UY">Khối Cấp ủy / Đảng</option>
                    <option value="CHINH_QUYEN">Khối Chính quyền / UBND</option>
                    <option value="DOAN_THE">Khối Đoàn thể / Mặt trận</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Từ khóa nhận diện AI (phân cách bằng dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="VD: đất đai, bồi thường giải phóng mặt bằng, môi trường, khoáng sản"
                  value={newDept.keywords}
                  onChange={e => setNewDept({ ...newDept, keywords: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDept(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                >
                  Lưu Đơn vị
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div key={dept.id} className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-2xs hover:border-blue-300 transition-all space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-extrabold text-slate-700">
                      {dept.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                      dept.category === 'CAP_UY' ? 'bg-red-50 text-red-700 border border-red-200' :
                      dept.category === 'CHINH_QUYEN' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {dept.category === 'CAP_UY' ? 'CẤP ỦY' : dept.category === 'CHINH_QUYEN' ? 'CHÍNH QUYỀN' : 'ĐOÀN THỂ'}
                    </span>
                  </div>

                  <h3 className="text-xs font-black text-slate-900 leading-snug">{dept.name}</h3>
                  <div className="text-[11px] text-slate-500 pt-1">Người đứng đầu: {dept.headPerson || 'Chánh Văn phòng'}</div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {dept.keywords.slice(0, 2).map((kw, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px]">
                        {kw}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => deleteDepartment(dept.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LEGAL BASIS */}
      {activeTab === 'legal' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Thư viện Căn cứ Pháp lý & Quy chế Cấp ủy</h2>
              <p className="text-xs text-slate-500">Các quy chế, luật và nghị định nền tảng để AI trích dẫn chính xác vào Phiếu trình</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {legalBasis.map((item) => (
              <div key={item.id} className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-900 font-extrabold text-[11px]">
                      {item.code}
                    </span>
                    <span className="text-[10px] text-slate-500">Ban hành: {item.issuer}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Hiệu lực: {item.validFrom}</span>
                </div>

                <h3 className="text-xs font-black text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.summary}</p>
                <div className="text-[10px] text-indigo-600 font-bold">Phạm vi: {item.scope}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM CONFIG */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Google Drive Configuration */}
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Cấu hình Lưu trữ Google Drive</h3>
                  <p className="text-[11px] text-slate-500">Đồng bộ tự động văn bản gốc và hồ sơ số hóa</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Mã Thư mục Lưu trữ (Folder ID)</label>
                  <input
                    type="text"
                    value={systemConfig.defaultDriveFolderId}
                    onChange={e => setSystemConfig({ ...systemConfig, defaultDriveFolderId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Tự động đẩy file lên Google Drive</div>
                    <div className="text-[10px] text-slate-500">Đồng bộ ngay khi tiếp nhận văn bản</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={systemConfig.enableDriveAutoUpload}
                    onChange={e => setSystemConfig({ ...systemConfig, enableDriveAutoUpload: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleTestDrive}
                    disabled={isTestingDrive}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    {isTestingDrive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                    <span>Kiểm tra Kết nối Drive</span>
                  </button>

                  <a
                    href={TARGET_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Mở Thư mục Drive</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                {driveTestStatus && (
                  <div className={`p-3 rounded-xl text-xs font-medium border ${
                    driveTestStatus.includes('thành công') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {driveTestStatus}
                  </div>
                )}
              </div>
            </div>

            {/* AI Model Tuning */}
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Cấu hình Trí tuệ Nhân tạo Gemini</h3>
                  <p className="text-[11px] text-slate-500">Mô hình phân tích, trích xuất và soạn thảo dự thảo</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Mô hình AI Ưu tiên</label>
                  <select
                    value={systemConfig.preferredAiModel}
                    onChange={e => setSystemConfig({ ...systemConfig, preferredAiModel: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Siêu tốc & Tiết kiệm độ trễ - Khuyên dùng)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Cân bằng tốc độ và phân tích sâu)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Phân tích văn bản phức tạp & độ chính xác cao)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Cơ quan Trình mặc định trên Phiếu Trình</label>
                  <input
                    type="text"
                    value={systemConfig.organizationName}
                    onChange={e => setSystemConfig({ ...systemConfig, organizationName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Chức danh người ký duyệt đề xuất</label>
                  <input
                    type="text"
                    value={systemConfig.defaultSignerTitle}
                    onChange={e => setSystemConfig({ ...systemConfig, defaultSignerTitle: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
