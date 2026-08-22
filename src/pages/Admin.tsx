import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Settings, Users, FolderGit2, BookOpen, 
  Activity, Save, Plus, Trash2, CheckCircle2, AlertCircle, 
  HardDrive, Sparkles, RefreshCw, Lock, ArrowUpRight, Search, 
  Building2, FileText, CheckSquare, Layers, ShieldCheck, ChevronRight,
  Database, Link2, Download, Upload, Cpu, Server, Check, Clock, BrainCircuit,
  Pencil, Edit3, X, Filter
} from 'lucide-react';
import { useAuthStore, isSystemAdmin } from '../store/authStore';
import { DepartmentConfig, RoutingRule, LegalBasisItem, SystemConfig, AuditLog, AppConnectionConfig, AssignedOfficer } from '../types';
import { 
  db, collection, getDocs, doc, setDoc, deleteDoc, writeBatch, serverTimestamp,
  TARGET_DRIVE_FOLDER_ID, TARGET_DRIVE_FOLDER_URL, getAccessToken, requestDriveAccess,
  CONNECTED_APP_ID, CONNECTED_APP_URL, CONNECTED_APP_NAME
} from '../lib/firebase';
import { 
  checkAppConnectionStatus, exportDatabaseBackup, importDatabaseBackup, DEFAULT_APP_CONNECTION 
} from '../lib/syncService';
import { 
  getActiveLearningRules, saveLearnedAdjustmentRule, LearningRule 
} from '../lib/learningEngine';

// Initial default configuration datasets tailored for Party & Local Government administration
const INITIAL_OFFICERS: AssignedOfficer[] = [
  { id: 'off-1', fullName: 'Đ/c Nguyễn Văn Hùng', roleType: 'DEPUTY_CHIEF', department: 'Phòng Tổng hợp Cấp ủy', phone: '0912345678', email: 'hungnv@vanphong.gov.vn', status: 'ACTIVE' },
  { id: 'off-2', fullName: 'Đ/c Lê Thị Minh', roleType: 'DEPUTY_CHIEF', department: 'Phòng Hành chính - Tổ chức', phone: '0913456789', email: 'minhlt@vanphong.gov.vn', status: 'ACTIVE' },
  { id: 'off-3', fullName: 'Đ/c Trần Quốc Tuấn', roleType: 'DEPUTY_CHIEF', department: 'Phòng Kinh tế - Đô thị', phone: '0914567890', email: 'tuantq@vanphong.gov.vn', status: 'ACTIVE' },
  { id: 'off-4', fullName: 'Đ/c Hoàng Văn Nam', roleType: 'DEPUTY_CHIEF', department: 'Phòng Nội chính - Tiếp công dân', phone: '0915678901', email: 'namhv@vanphong.gov.vn', status: 'ACTIVE' },
  { id: 'off-5', fullName: 'Đ/c Trần Thị Mai', roleType: 'SPECIALIST', department: 'Phòng Tổng hợp Cấp ủy', phone: '0981112233', email: 'maitt@vanphong.gov.vn', status: 'ACTIVE' },
  { id: 'off-6', fullName: 'Đ/c Phạm Văn Minh', roleType: 'SPECIALIST', department: 'Bộ phận Văn thư - Lưu trữ', phone: '0982223344', email: 'minhpv@vanphong.gov.vn', status: 'ACTIVE' },
];

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

  const [activeTab, setActiveTab] = useState<'overview' | 'database' | 'brain' | 'routing' | 'learning' | 'departments' | 'officers' | 'legal' | 'system'>('overview');
  
  const [learnedRules, setLearnedRules] = useState<LearningRule[]>([]);
  const [isLoadingLearned, setIsLoadingLearned] = useState(false);
  const [showAddLearnedRule, setShowAddLearnedRule] = useState(false);
  const [newLearnedRule, setNewLearnedRule] = useState({
    keywordTrigger: '',
    suggestedLeadDept: 'Văn phòng Cấp ủy',
    suggestedAction: '',
    notes: ''
  });

  // Google Drive AI Brain Engine states
  const [isSyncingBrain, setIsSyncingBrain] = useState(false);
  const [isImportingBrain, setIsImportingBrain] = useState(false);
  const [isSynthesizingBrain, setIsSynthesizingBrain] = useState(false);
  const [brainSyncStatus, setBrainSyncStatus] = useState<string | null>(null);
  const [brainDriveInfo, setBrainDriveInfo] = useState<{
    fileId?: string;
    driveUrl?: string;
    driveFolderUrl?: string;
    updatedAt?: string;
    sizeBytes?: number;
    ruleCount?: number;
  } | null>(null);
  
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

  const [systemUsers] = useState([
    { uid: 'admin-primary', name: 'Nguyễn Huy (Quản trị viên)', email: 'nguyenhuy.thudaumot@gmail.com', role: 'ADMIN', department: 'Văn phòng Cấp ủy', status: 'Đang hoạt động' },
    { uid: 'usr-1', name: 'Chuyên viên Tổng hợp Cấp ủy', email: 'chuyenvien.capuy@vanphong.gov.vn', role: 'OFFICE', department: 'Văn phòng Cấp ủy', status: 'Đang hoạt động' },
    { uid: 'usr-2', name: 'Chuyên viên Văn thư - Lưu trữ', email: 'vanthu@vanphong.gov.vn', role: 'OFFICE', department: 'Bộ phận Văn thư', status: 'Đang hoạt động' },
    { uid: 'usr-3', name: 'Lãnh đạo Phê duyệt', email: 'lanhdao.vp@vanphong.gov.vn', role: 'LEADER', department: 'Lãnh đạo Văn phòng', status: 'Đang hoạt động' },
  ]);

  const [officers, setOfficers] = useState<AssignedOfficer[]>(() => {
    const saved = localStorage.getItem('trolycvp_officers');
    return saved ? JSON.parse(saved) : INITIAL_OFFICERS;
  });
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [newOfficer, setNewOfficer] = useState({
    fullName: '',
    roleType: 'DEPUTY_CHIEF' as 'DEPUTY_CHIEF' | 'SPECIALIST',
    department: 'Phòng Tổng hợp Cấp ủy',
    phone: '',
    email: '',
    status: 'ACTIVE' as 'ACTIVE' | 'BUSY' | 'ON_LEAVE'
  });
  const [editingOfficer, setEditingOfficer] = useState<AssignedOfficer | null>(null);
  const [officerSearchQuery, setOfficerSearchQuery] = useState('');
  const [officerRoleFilter, setOfficerRoleFilter] = useState<'ALL' | 'DEPUTY_CHIEF' | 'SPECIALIST'>('ALL');

  const filteredOfficers = officers.filter(officer => {
    const matchesRole = officerRoleFilter === 'ALL' || officer.roleType === officerRoleFilter;
    if (!matchesRole) return false;
    if (!officerSearchQuery.trim()) return true;
    const q = officerSearchQuery.toLowerCase();
    return officer.fullName.toLowerCase().includes(q) ||
           officer.department.toLowerCase().includes(q) ||
           (officer.phone && officer.phone.includes(q)) ||
           (officer.email && officer.email.toLowerCase().includes(q));
  });

  const handleAddOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficer.fullName.trim()) return;
    const officer: AssignedOfficer = {
      id: `off-${Date.now()}`,
      fullName: newOfficer.fullName.trim(),
      roleType: newOfficer.roleType,
      department: newOfficer.department,
      phone: newOfficer.phone.trim(),
      email: newOfficer.email.trim(),
      status: newOfficer.status
    };
    const updated = [...officers, officer];
    setOfficers(updated);
    localStorage.setItem('trolycvp_officers', JSON.stringify(updated));
    setNewOfficer({ fullName: '', roleType: 'DEPUTY_CHIEF', department: 'Phòng Tổng hợp Cấp ủy', phone: '', email: '', status: 'ACTIVE' });
    setShowAddOfficer(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveEditedOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOfficer) return;
    const updated = officers.map(o => o.id === editingOfficer.id ? editingOfficer : o);
    setOfficers(updated);
    localStorage.setItem('trolycvp_officers', JSON.stringify(updated));
    setEditingOfficer(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const deleteOfficer = (id: string) => {
    const updated = officers.filter(o => o.id !== id);
    setOfficers(updated);
    localStorage.setItem('trolycvp_officers', JSON.stringify(updated));
    setDeleteConfirmId(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [driveTestStatus, setDriveTestStatus] = useState<string | null>(null);

  // New Department Form modal/drawer state
  const [newDept, setNewDept] = useState({ code: '', name: '', category: 'CAP_UY' as const, headPerson: '', keywords: '' });
  const [showAddDept, setShowAddDept] = useState(false);

  // Edit Department State
  const [editingDept, setEditingDept] = useState<DepartmentConfig | null>(null);
  const [editingDeptKeywordsStr, setEditingDeptKeywordsStr] = useState('');

  // Search & Filter State for Departments
  const [deptSearchQuery, setDeptSearchQuery] = useState('');
  const [deptCategoryFilter, setDeptCategoryFilter] = useState<'ALL' | 'CAP_UY' | 'CHINH_QUYEN' | 'DOAN_THE'>('ALL');

  // New Routing Rule Form state
  const [newRule, setNewRule] = useState({ targetAuthority: '', criteria: '', urgencyLevel: 'THUONG_KHAN' as const, suggestedLeadDept: 'Văn phòng Cấp ủy', defaultDeadlineDays: 3 });
  const [showAddRule, setShowAddRule] = useState(false);

  // Edit Routing Rule State
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [ruleSearchQuery, setRuleSearchQuery] = useState('');

  const filteredRoutingRules = routingRules.filter(rule => {
    if (!ruleSearchQuery.trim()) return true;
    const q = ruleSearchQuery.toLowerCase();
    return rule.targetAuthority.toLowerCase().includes(q) ||
           rule.criteria.toLowerCase().includes(q) ||
           rule.suggestedLeadDept.toLowerCase().includes(q);
  });

  const filteredDepartments = departments.filter(dept => {
    const matchesCategory = deptCategoryFilter === 'ALL' || dept.category === deptCategoryFilter;
    if (!matchesCategory) return false;
    if (!deptSearchQuery.trim()) return true;
    const q = deptSearchQuery.toLowerCase();
    return dept.code.toLowerCase().includes(q) ||
           dept.name.toLowerCase().includes(q) ||
           (dept.keywords && dept.keywords.some(k => k.toLowerCase().includes(q)));
  });

  const loadLearnedRules = async () => {
    setIsLoadingLearned(true);
    try {
      const rules = await getActiveLearningRules();
      setLearnedRules(rules);
    } catch (err) {
      console.error("Error loading learned rules:", err);
    } finally {
      setIsLoadingLearned(false);
    }
  };

  // Run initial connection test on mount
  useEffect(() => {
    runConnectionDiagnostic();
    loadLearnedRules();
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
    localStorage.setItem('trolycvp_officers', JSON.stringify(officers));
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

  // Export AI Brain Knowledge Base to Google Drive (_BO_NAO_THAM_MUU_AI.json)
  const handleExportBrainToDrive = async () => {
    setIsSyncingBrain(true);
    setBrainSyncStatus("Đang đóng gói và mã hóa Bộ Não AI để tải lên Google Drive...");
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await requestDriveAccess();
      }

      if (!token) {
        setBrainSyncStatus("Cần chấp nhận quyền truy cập Google Drive để tiếp tục.");
        setIsSyncingBrain(false);
        return;
      }

      const res = await fetch('/api/drive/export-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceToken: token,
          folderId: TARGET_DRIVE_FOLDER_ID,
          learnedRules,
          departments,
          routingRules,
          legalBases: legalBasis,
          styleMemory: {
            preferredStyles: ['Quyết liệt', 'Dân vận khéo'],
            frequentSigners: ['Bí thư Đảng ủy', 'Chánh Văn phòng']
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setBrainSyncStatus("Đã sao lưu thành công Bộ Não AI lên Google Drive!");
        setBrainDriveInfo({
          fileId: data.driveFileId,
          driveUrl: data.driveUrl,
          driveFolderUrl: data.driveFolderUrl,
          updatedAt: data.updatedAt,
          sizeBytes: data.sizeBytes,
          ruleCount: learnedRules.length
        });
      } else {
        setBrainSyncStatus(`Lỗi xuất Bộ Não AI: ${data.error || 'Không xác định'}`);
      }
    } catch (err: any) {
      console.error("Export brain error:", err);
      setBrainSyncStatus(`Lỗi: ${err.message || 'Không thể đồng bộ'}`);
    } finally {
      setIsSyncingBrain(false);
    }
  };

  // Import AI Brain Knowledge from Google Drive (_BO_NAO_THAM_MUU_AI.json)
  const handleImportBrainFromDrive = async () => {
    setIsImportingBrain(true);
    setBrainSyncStatus("Đang truy vấn tệp _BO_NAO_THAM_MUU_AI.json trên Google Drive cơ quan...");
    try {
      let token = await getAccessToken();
      if (!token) {
        token = await requestDriveAccess();
      }

      if (!token) {
        setBrainSyncStatus("Cần cấp quyền truy cập Google Drive để nạp Bộ Não AI.");
        setIsImportingBrain(false);
        return;
      }

      const res = await fetch('/api/drive/import-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceToken: token,
          folderId: TARGET_DRIVE_FOLDER_ID
        })
      });

      const data = await res.json();
      if (data.success && data.brainData) {
        const brain = data.brainData;
        
        if (brain.learnedRules && Array.isArray(brain.learnedRules)) {
          setLearnedRules(brain.learnedRules);
        }
        if (brain.departments && Array.isArray(brain.departments)) {
          setDepartments(brain.departments);
          localStorage.setItem('trolycvp_departments', JSON.stringify(brain.departments));
        }
        if (brain.routingRules && Array.isArray(brain.routingRules)) {
          setRoutingRules(brain.routingRules);
          localStorage.setItem('trolycvp_routing_rules', JSON.stringify(brain.routingRules));
        }
        if (brain.legalBases && Array.isArray(brain.legalBases)) {
          setLegalBasis(brain.legalBases);
          localStorage.setItem('trolycvp_legal_basis', JSON.stringify(brain.legalBases));
        }

        setBrainSyncStatus(`Đã nạp thành công Bộ Não AI! (${brain.learnedRules?.length || 0} quy tắc máy học, ${brain.departments?.length || 0} phòng ban)`);
        setBrainDriveInfo({
          fileId: data.fileId,
          updatedAt: data.modifiedTime,
          ruleCount: brain.learnedRules?.length || 0
        });

        // Batch save imported brain to Firestore
        try {
          const batch = writeBatch(db);
          if (brain.departments) {
            brain.departments.forEach((dept: any) => batch.set(doc(db, 'departments', dept.id), dept, { merge: true }));
          }
          if (brain.routingRules) {
            brain.routingRules.forEach((rule: any) => batch.set(doc(db, 'routing_rules', rule.id), rule, { merge: true }));
          }
          if (brain.learnedRules) {
            brain.learnedRules.forEach((lRule: any) => {
              if (lRule.id) batch.set(doc(db, 'learning_rules', lRule.id), lRule, { merge: true });
            });
          }
          await batch.commit();
        } catch (fErr) {
          console.warn("Could not write imported brain to Firestore in background:", fErr);
        }

      } else {
        setBrainSyncStatus(`Lỗi: ${data.error || 'Không tìm thấy Bộ Não AI trên Google Drive'}`);
      }
    } catch (err: any) {
      console.error("Import brain error:", err);
      setBrainSyncStatus(`Lỗi: ${err.message || 'Không thể nạp tệp'}`);
    } finally {
      setIsImportingBrain(false);
    }
  };

  // Synthesize Knowledge & Generate new AI Machine Learning Rules
  const handleSynthesizeBrainKnowledge = async () => {
    setIsSynthesizingBrain(true);
    setBrainSyncStatus("AI Gemini đang phân tích các hồ sơ văn bản để tổng hợp quy tắc máy học mới...");
    try {
      // Fetch documents from Firestore
      const snap = await getDocs(collection(db, 'documents'));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (docs.length === 0) {
        setBrainSyncStatus("Chưa có hồ sơ văn bản trong CSDL để Gemini phân tích.");
        setIsSynthesizingBrain(false);
        return;
      }

      const res = await fetch('/api/brain/synthesize-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: docs,
          existingRules: learnedRules
        })
      });

      const data = await res.json();
      if (data.newRules && Array.isArray(data.newRules) && data.newRules.length > 0) {
        const addedRules: LearningRule[] = [];
        for (const nr of data.newRules) {
          const saved = await saveLearnedAdjustmentRule({
            keywordTrigger: nr.keywordTrigger,
            suggestedLeadDept: nr.suggestedLeadDept,
            suggestedAction: nr.suggestedAction,
            learnedAt: new Date().toLocaleDateString('vi-VN'),
            confidence: nr.confidence || 95,
            useCount: 1,
            isActive: true,
            notes: nr.notes || 'Tổng hợp tự động bởi AI Brain Synthesizer'
          });
          addedRules.push(saved);
        }
        await loadLearnedRules();
        setBrainSyncStatus(`Gemini đã phát hiện và thêm ${addedRules.length} quy tắc máy học mới vào Bộ Não AI!`);
      } else {
        setBrainSyncStatus("Bộ Não AI hiện tại đã tối ưu toàn bộ quy tắc. Chưa phát hiện quy tắc mới.");
      }
    } catch (err: any) {
      console.error("Synthesize knowledge error:", err);
      setBrainSyncStatus(`Lỗi phân tích: ${err.message || 'Không thể tổng hợp'}`);
    } finally {
      setIsSynthesizingBrain(false);
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
    const updated = [...departments, dept];
    setDepartments(updated);
    localStorage.setItem('trolycvp_departments', JSON.stringify(updated));
    setDoc(doc(db, 'departments', dept.id), dept, { merge: true }).catch(err => console.warn("Firestore dept save error:", err));
    setNewDept({ code: '', name: '', category: 'CAP_UY', headPerson: '', keywords: '' });
    setShowAddDept(false);
  };

  const handleStartEditDepartment = (dept: DepartmentConfig) => {
    setEditingDept({ ...dept });
    setEditingDeptKeywordsStr(dept.keywords ? dept.keywords.join(', ') : '');
  };

  const handleSaveEditedDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;

    const formattedKeywords = editingDeptKeywordsStr
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    const updatedDept: DepartmentConfig = {
      ...editingDept,
      code: editingDept.code.toUpperCase(),
      keywords: formattedKeywords
    };

    const updatedList = departments.map(d => d.id === updatedDept.id ? updatedDept : d);
    setDepartments(updatedList);
    localStorage.setItem('trolycvp_departments', JSON.stringify(updatedList));

    // Save to Firestore in background
    setDoc(doc(db, 'departments', updatedDept.id), updatedDept, { merge: true })
      .catch(err => console.warn("Firestore update dept error:", err));

    setEditingDept(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveEditedRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    const updatedList = routingRules.map(r => r.id === editingRule.id ? editingRule : r);
    setRoutingRules(updatedList);
    localStorage.setItem('trolycvp_routing_rules', JSON.stringify(updatedList));

    setDoc(doc(db, 'routing_rules', editingRule.id), editingRule, { merge: true })
      .catch(err => console.warn("Firestore update rule error:", err));

    setEditingRule(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
    const updated = [...routingRules, rule];
    setRoutingRules(updated);
    localStorage.setItem('trolycvp_routing_rules', JSON.stringify(updated));
    setDoc(doc(db, 'routing_rules', rule.id), rule, { merge: true }).catch(err => console.warn("Firestore rule save error:", err));
    setNewRule({ targetAuthority: '', criteria: '', urgencyLevel: 'THUONG_KHAN', suggestedLeadDept: 'Văn phòng Cấp ủy', defaultDeadlineDays: 3 });
    setShowAddRule(false);
  };

  const deleteDepartment = (id: string) => {
    const updated = departments.filter(d => d.id !== id);
    setDepartments(updated);
    localStorage.setItem('trolycvp_departments', JSON.stringify(updated));
    deleteDoc(doc(db, 'departments', id)).catch(err => console.warn("Firestore delete dept error:", err));
  };

  const deleteRule = (id: string) => {
    const updated = routingRules.filter(r => r.id !== id);
    setRoutingRules(updated);
    localStorage.setItem('trolycvp_routing_rules', JSON.stringify(updated));
    deleteDoc(doc(db, 'routing_rules', id)).catch(err => console.warn("Firestore delete rule error:", err));
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

      {/* Navigation Tabs - Grouped & Compact */}
      <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
        {/* Row 1: Operations & AI & System */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-slate-100">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 flex-shrink-0">Vận hành:</span>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Tổng quan</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'database'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/60'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>CSDL & Bộ nhớ</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </button>

          <button
            onClick={() => setActiveTab('brain')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'brain'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-indigo-900 bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            <span>Bộ Não AI Drive</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'system'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Cấu hình AI</span>
          </button>
        </div>

        {/* Row 2: Rules, Staff & Legal */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 flex-shrink-0">Quy tắc & NS:</span>
          <button
            onClick={() => setActiveTab('routing')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'routing'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Phân luồng ({routingRules.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('learning')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'learning'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-emerald-800 bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-300'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tri thức AI ({learnedRules.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'departments'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Đơn vị ({departments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('officers')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'officers'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Chuyên viên & Cán bộ ({officers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('legal')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'legal'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Căn cứ Pháp lý ({legalBasis.length})</span>
          </button>
        </div>
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

      {/* TAB: GOOGLE DRIVE AI BRAIN STORAGE ENGINE */}
      {activeTab === 'brain' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Hero Banner for AI Storage Brain */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 p-6 md:p-8 rounded-3xl text-white border border-indigo-500/30 shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                  <BrainCircuit className="w-8 h-8 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-white uppercase tracking-wide">
                      Bộ Não AI Tham Mưu & Tri Thức Máy Học trên Google Drive
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-extrabold border border-indigo-400/40">
                      Tệp: _BO_NAO_THAM_MUU_AI.json
                    </span>
                  </div>
                  <p className="text-xs text-indigo-100/80 max-w-2xl leading-relaxed">
                    Trung tâm lưu trữ tri thức tập trung. Đóng gói quy tắc học máy, ma trận thẩm quyền, danh mục cơ quan và lịch sử chỉ đạo thành tệp tri thức thông minh trên Google Drive cơ quan. giúp Trợ lý AI liên tục thông minh hơn!
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportBrainToDrive}
                  disabled={isSyncingBrain}
                  className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Upload className={`w-4 h-4 ${isSyncingBrain ? 'animate-bounce' : ''}`} />
                  <span>{isSyncingBrain ? 'Đang tải lên Drive...' : 'Sao lưu Bộ Não lên Drive'}</span>
                </button>

                <button
                  onClick={handleImportBrainFromDrive}
                  disabled={isImportingBrain}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Download className={`w-4 h-4 ${isImportingBrain ? 'animate-bounce' : ''}`} />
                  <span>{isImportingBrain ? 'Đang nạp từ Drive...' : 'Nạp Tri thức từ Drive'}</span>
                </button>

                <button
                  onClick={handleSynthesizeBrainKnowledge}
                  disabled={isSynthesizingBrain}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${isSynthesizingBrain ? 'animate-spin' : ''}`} />
                  <span>{isSynthesizingBrain ? 'Gemini đang phân tích...' : 'Gemini Tự học Tri thức'}</span>
                </button>
              </div>
            </div>

            {/* Knowledge Blueprint Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-indigo-500/20 relative z-10">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-[10px] font-bold text-indigo-300 uppercase">Quy tắc AI Đã học</div>
                <div className="text-xl font-black text-white">{learnedRules.length} quy tắc</div>
                <div className="text-[10px] text-indigo-200/60">Tự động học từ Lãnh đạo</div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-[10px] font-bold text-indigo-300 uppercase">Danh mục Đơn vị</div>
                <div className="text-xl font-black text-white">{departments.length} phòng/ban</div>
                <div className="text-[10px] text-indigo-200/60">Cơ cấu ban ngành chuẩn</div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-[10px] font-bold text-indigo-300 uppercase">Ma trận Thẩm quyền</div>
                <div className="text-xl font-black text-white">{routingRules.length} cấp chỉ đạo</div>
                <div className="text-[10px] text-indigo-200/60">Phân luồng thẩm quyền</div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-[10px] font-bold text-indigo-300 uppercase">Căn cứ Pháp lý</div>
                <div className="text-xl font-black text-white">{legalBasis.length} nghị quyết</div>
                <div className="text-[10px] text-indigo-200/60">Văn bản quy phạm</div>
              </div>
            </div>
          </div>

          {/* Sync Status Feedback Banner */}
          {brainSyncStatus && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs font-bold text-indigo-900 flex items-center justify-between gap-3 animate-in fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600 flex-shrink-0 animate-pulse" />
                <span>{brainSyncStatus}</span>
              </div>
              {brainDriveInfo?.driveUrl && (
                <a
                  href={brainDriveInfo.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 hover:bg-indigo-700 transition-colors"
                >
                  <span>Mở tệp trên Drive</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Live Inspection Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Machine Learning Rules in Brain */}
            <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Quy tắc AI Đã học (_BO_NAO_THAM_MUU_AI.json)
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  {learnedRules.length} quy tắc
                </span>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {learnedRules.map((rule, idx) => (
                  <div key={rule.id || idx} className="p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200/60 transition-all space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-extrabold text-[10px]">
                        Từ khóa: [{rule.keywordTrigger}]
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Tin cậy: {rule.confidence}%</span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      Giao: <span className="text-blue-700">{rule.suggestedLeadDept}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Đề xuất: {rule.suggestedAction}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2: Department & Authority Directory */}
            <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Từ điển Cơ quan & Phân công Thẩm quyền
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold">
                  {departments.length} đơn vị
                </span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {departments.map((dept) => (
                  <div key={dept.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{dept.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold">{dept.code}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">Người đứng đầu: <span className="font-medium text-slate-700">{dept.headPerson}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${dept.category === 'CAP_UY' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                        {dept.category === 'CAP_UY' ? 'Cấp ủy' : 'Chính quyền'}
                      </span>
                      <button
                        onClick={() => {
                          handleStartEditDepartment(dept);
                          setActiveTab('departments');
                        }}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                        title="Chỉnh sửa đơn vị này"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Sửa</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* TAB 1: OVERVIEW & AUDIT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
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
                  {systemUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center">
                          {user.name.charAt(0)}
                        </div>
                        <span>{user.name}</span>
                      </td>
                      <td className="py-3 text-slate-600 font-mono">{user.email}</td>
                      <td className="py-3 text-slate-700">{user.department}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          user.role === 'ADMIN' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          user.role === 'LEADER' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {user.status}
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

      {/* TAB: MACHINE LEARNING & AI ADAPTIVE RULES */}
      {activeTab === 'learning' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Tri thức Máy học & Quy tắc AI Tự học (Adaptive Learning Rules)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Danh sách bộ quy tắc phân luồng đã được AI tự động ghi nhớ từ các phản hồi & điều chỉnh trực tiếp của Lãnh đạo/Chuyên viên.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadLearnedRules}
                disabled={isLoadingLearned}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoadingLearned ? 'animate-spin' : ''}`} />
                <span>Làm mới ({learnedRules.length})</span>
              </button>

              <button
                onClick={() => setShowAddLearnedRule(!showAddLearnedRule)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Quy tắc Máy học</span>
              </button>
            </div>
          </div>

          {/* Add New Learned Rule Form */}
          {showAddLearnedRule && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newLearnedRule.keywordTrigger.trim()) return;
                try {
                  await saveLearnedAdjustmentRule({
                    keywordTrigger: newLearnedRule.keywordTrigger,
                    suggestedLeadDept: newLearnedRule.suggestedLeadDept,
                    suggestedAction: newLearnedRule.suggestedAction || 'Giao cơ quan chủ trì tham mưu',
                    learnedAt: new Date().toLocaleDateString('vi-VN'),
                    confidence: 99,
                    useCount: 1,
                    isActive: true,
                    notes: newLearnedRule.notes || 'Thêm thủ công bởi Quản trị viên'
                  });
                  setNewLearnedRule({ keywordTrigger: '', suggestedLeadDept: 'Văn phòng Cấp ủy', suggestedAction: '', notes: '' });
                  setShowAddLearnedRule(false);
                  loadLearnedRules();
                } catch (err) {
                  console.error("Error saving manual learned rule:", err);
                }
              }}
              className="bg-emerald-50/60 border border-emerald-200 p-5 rounded-3xl space-y-4 shadow-sm animate-in fade-in"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-900 border-b border-emerald-200/80 pb-2">
                <BrainCircuit className="w-4 h-4 text-emerald-600" />
                <span>Thêm Quy tắc Phân luồng Máy học cho AI</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Từ khóa Kích hoạt (Keyword Trigger) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLearnedRule.keywordTrigger}
                    onChange={(e) => setNewLearnedRule({ ...newLearnedRule, keywordTrigger: e.target.value })}
                    placeholder="VD: trật tự đô thị, lấn chiếm vỉa hè, cấp phép xây dựng..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cơ quan / Đơn vị Chủ trì Giao xử lý *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLearnedRule.suggestedLeadDept}
                    onChange={(e) => setNewLearnedRule({ ...newLearnedRule, suggestedLeadDept: e.target.value })}
                    placeholder="VD: Đội Trật tự Đô thị & Công an Phường"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hướng Phân luồng / Hành động Đề xuất
                  </label>
                  <input
                    type="text"
                    value={newLearnedRule.suggestedAction}
                    onChange={(e) => setNewLearnedRule({ ...newLearnedRule, suggestedAction: e.target.value })}
                    placeholder="VD: Giao Đội Trật tự Đô thị ra quân kiểm tra dứt điểm..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ghi chú nguồn gốc / Lý do điều chỉnh
                  </label>
                  <input
                    type="text"
                    value={newLearnedRule.notes}
                    onChange={(e) => setNewLearnedRule({ ...newLearnedRule, notes: e.target.value })}
                    placeholder="VD: Cập nhật theo kết luận cuộc họp Thường trực Thành ủy..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200/80">
                <button
                  type="button"
                  onClick={() => setShowAddLearnedRule(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <BrainCircuit className="w-4 h-4" />
                  <span>Lưu Quy tắc AI</span>
                </button>
              </div>
            </form>
          )}

          {/* List of Learned Rules */}
          {isLoadingLearned ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200">
              Đang tải bộ quy tắc tri thức AI...
            </div>
          ) : learnedRules.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-2">
              <BrainCircuit className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs font-bold text-slate-700">Chưa có quy tắc học máy nào được lưu</div>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Khi Lãnh đạo bấm "Điều chỉnh phương án & Huấn luyện AI" ở trang Chi tiết Văn bản, hệ thống sẽ tự động cập nhật tri thức vào đây.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {learnedRules.map((rule) => (
                <div key={rule.id} className="bg-white/95 backdrop-blur-md p-5 rounded-3xl border border-emerald-200/80 shadow-2xs hover:border-emerald-400 transition-all space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 font-black text-xs border border-emerald-300 flex items-center gap-1">
                          <BrainCircuit className="w-3.5 h-3.5 text-emerald-600" />
                          <span>"{rule.keywordTrigger}"</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                          Độ tin cậy: {rule.confidence || 98}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 font-bold pt-1">
                        👉 Đơn vị chủ trì: <span className="text-blue-700">{rule.suggestedLeadDept}</span>
                      </p>
                      {rule.suggestedAction && (
                        <p className="text-xs text-slate-600 italic">
                          Hành động: "{rule.suggestedAction}"
                        </p>
                      )}
                    </div>

                    <button
                      onClick={async () => {
                        if (!rule.id) return;
                        if (confirm(`Bạn có chắc muốn xóa quy tắc tri thức AI cho từ khóa "${rule.keywordTrigger}"?`)) {
                          try {
                            await deleteDoc(doc(db, 'ai_learning_rules', rule.id));
                            loadLearnedRules();
                          } catch (err) {
                            console.error("Error deleting rule:", err);
                          }
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span>Học ngày: <strong>{rule.learnedAt}</strong></span>
                    {rule.notes && <span className="truncate max-w-[200px] text-slate-400">{rule.notes}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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

          {/* Rules List Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 p-3 rounded-2xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm ma trận thẩm quyền..."
                value={ruleSearchQuery}
                onChange={e => setRuleSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap px-2">
              Hiển thị: {filteredRoutingRules.length} / {routingRules.length} quy chuẩn
            </span>
          </div>

          {/* Edit Routing Rule Modal */}
          {editingRule && (
            <div className="fixed inset-0 z-50 bg-blue-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <form onSubmit={handleSaveEditedRule} className="bg-white p-6 rounded-3xl border border-blue-200 shadow-2xl max-w-2xl w-full space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-black text-blue-900 uppercase tracking-wider">
                    <Pencil className="w-4 h-4 text-blue-600" />
                    <span>Chỉnh sửa Quy chuẩn Phân luồng Thẩm quyền</span>
                  </div>
                  <button type="button" onClick={() => setEditingRule(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Thẩm quyền chỉ đạo / Xử lý</label>
                    <input
                      type="text"
                      required
                      value={editingRule.targetAuthority}
                      onChange={e => setEditingRule({ ...editingRule, targetAuthority: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Đơn vị chủ trì tham mưu đề xuất</label>
                    <input
                      type="text"
                      required
                      value={editingRule.suggestedLeadDept}
                      onChange={e => setEditingRule({ ...editingRule, suggestedLeadDept: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Điều kiện / Tiêu chí kích hoạt (AI Keyword Match)</label>
                    <textarea
                      rows={3}
                      required
                      value={editingRule.criteria}
                      onChange={e => setEditingRule({ ...editingRule, criteria: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Thời hạn mặc định (Ngày)</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      required
                      value={editingRule.defaultDeadlineDays}
                      onChange={e => setEditingRule({ ...editingRule, defaultDeadlineDays: Number(e.target.value) })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Mức độ khẩn</label>
                    <select
                      value={editingRule.urgencyLevel}
                      onChange={e => setEditingRule({ ...editingRule, urgencyLevel: e.target.value as any })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="BINH_THUONG">Bình thường</option>
                      <option value="THUONG_KHAN">Thượng khẩn</option>
                      <option value="HOA_TOC">Hỏa tốc</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRule.isActive}
                      onChange={e => setEditingRule({ ...editingRule, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">Kích hoạt quy chuẩn này</span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingRule(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                    >
                      Lưu Thay Đổi
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Rules List */}
          <div className="grid grid-cols-1 gap-4">
            {filteredRoutingRules.map((rule) => (
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
                      onClick={() => setEditingRule(rule)}
                      className="p-1.5 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1 text-[11px] font-bold"
                      title="Chỉnh sửa quy chuẩn"
                    >
                      <Pencil className="w-4 h-4" />
                      <span>Sửa</span>
                    </button>
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
                      title="Xóa quy chuẩn"
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

          {/* Departments Search & Filter Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/80 p-3 rounded-2xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo mã, tên đơn vị, người đứng đầu, từ khóa..."
                value={deptSearchQuery}
                onChange={e => setDeptSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDeptCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  deptCategoryFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({departments.length})
              </button>
              <button
                type="button"
                onClick={() => setDeptCategoryFilter('CAP_UY')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  deptCategoryFilter === 'CAP_UY'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                Khối Cấp ủy ({departments.filter(d => d.category === 'CAP_UY').length})
              </button>
              <button
                type="button"
                onClick={() => setDeptCategoryFilter('CHINH_QUYEN')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  deptCategoryFilter === 'CHINH_QUYEN'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Khối Chính quyền ({departments.filter(d => d.category === 'CHINH_QUYEN').length})
              </button>
              <button
                type="button"
                onClick={() => setDeptCategoryFilter('DOAN_THE')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  deptCategoryFilter === 'DOAN_THE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Khối Đoàn thể ({departments.filter(d => d.category === 'DOAN_THE').length})
              </button>
            </div>
          </div>

          {/* Edit Department Modal */}
          {editingDept && (
            <div className="fixed inset-0 z-50 bg-blue-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <form onSubmit={handleSaveEditedDepartment} className="bg-white p-6 rounded-3xl border border-blue-200 shadow-2xl max-w-2xl w-full space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-black text-blue-900 uppercase tracking-wider">
                    <Pencil className="w-4 h-4 text-blue-600" />
                    <span>Chỉnh sửa Đơn vị / Cơ quan tham mưu</span>
                  </div>
                  <button type="button" onClick={() => setEditingDept(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Mã viết tắt</label>
                    <input
                      type="text"
                      required
                      value={editingDept.code}
                      onChange={e => setEditingDept({ ...editingDept, code: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Tên đơn vị đầy đủ</label>
                    <input
                      type="text"
                      required
                      value={editingDept.name}
                      onChange={e => setEditingDept({ ...editingDept, name: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Khối trực thuộc</label>
                    <select
                      value={editingDept.category}
                      onChange={e => setEditingDept({ ...editingDept, category: e.target.value as any })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CAP_UY">Khối Cấp ủy / Đảng</option>
                      <option value="CHINH_QUYEN">Khối Chính quyền / UBND</option>
                      <option value="DOAN_THE">Khối Đoàn thể / Mặt trận</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Người đứng đầu / Chức danh</label>
                    <input
                      type="text"
                      placeholder="VD: Trưởng ban Tổ chức, Chánh Văn phòng, Giám đốc Sở..."
                      value={editingDept.headPerson || ''}
                      onChange={e => setEditingDept({ ...editingDept, headPerson: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Từ khóa nhận diện AI (phân cách bằng dấu phẩy)</label>
                  <textarea
                    rows={2}
                    placeholder="VD: đất đai, bồi thường giải phóng mặt bằng, môi trường, khoáng sản..."
                    value={editingDeptKeywordsStr}
                    onChange={e => setEditingDeptKeywordsStr(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Các từ khóa giúp Gemini phân loại và tự động chuyển văn bản đến đơn vị này.</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingDept.isDefaultLead || false}
                      onChange={e => setEditingDept({ ...editingDept, isDefaultLead: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">Đơn vị chủ trì mặc định</span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingDept(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                    >
                      Cập Nhật Đơn Vị
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map((dept) => (
              <div key={dept.id} className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-2xs hover:border-blue-300 transition-all space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-extrabold text-slate-700">
                      {dept.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                      dept.category === 'CAP_UY' ? 'bg-red-50 text-red-700 border border-red-200' :
                      dept.category === 'CHINH_QUYEN' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {dept.category === 'CAP_UY' ? 'CẤP ỦY' : dept.category === 'CHINH_QUYEN' ? 'CHÍNH QUYỀN' : 'ĐOÀN THỂ'}
                    </span>
                  </div>

                  <h3 className="text-xs font-black text-slate-900 leading-snug">{dept.name}</h3>
                  <div className="text-[11px] text-slate-500 pt-1">Người đứng đầu: <strong className="text-slate-700 font-bold">{dept.headPerson || 'Chánh Văn phòng'}</strong></div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1 max-w-[65%]">
                    {dept.keywords && dept.keywords.slice(0, 3).map((kw, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-medium">
                        {kw}
                      </span>
                    ))}
                    {dept.keywords && dept.keywords.length > 3 && (
                      <span className="text-[9px] font-bold text-slate-400">+{dept.keywords.length - 3}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEditDepartment(dept)}
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold"
                      title="Chỉnh sửa đơn vị"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      onClick={() => deleteDepartment(dept.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa đơn vị"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: OFFICERS (Phó Chánh VP & Chuyên viên) */}
      {activeTab === 'officers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Quản lý Chuyên viên Văn phòng Đảng ủy & Phó Chánh Văn phòng</h2>
              <p className="text-xs text-slate-500">Quản lý nhân sự chuyên viên thụ lý văn bản, phân công nhiệm vụ và theo dõi tiến độ</p>
            </div>
            <button
              onClick={() => setShowAddOfficer(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Nhân sự mới</span>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo họ tên, phòng ban, số điện thoại..."
                value={officerSearchQuery}
                onChange={e => setOfficerSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={officerRoleFilter}
                onChange={e => setOfficerRoleFilter(e.target.value as any)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="DEPUTY_CHIEF">Phó Chánh Văn phòng</option>
                <option value="SPECIALIST">Chuyên viên thụ lý</option>
              </select>
            </div>
          </div>

          {/* Add Officer Modal / Form */}
          {showAddOfficer && (
            <form onSubmit={handleAddOfficer} className="bg-white p-6 rounded-3xl border border-blue-200 shadow-md space-y-4 animate-in fade-in">
              <div className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center justify-between">
                <span>Thêm Nhân sự Phó Chánh Văn phòng / Chuyên viên mới</span>
                <button type="button" onClick={() => setShowAddOfficer(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Họ và Tên (kèm học hàm/đơn vị)</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Đ/c Nguyễn Văn Hùng"
                    value={newOfficer.fullName}
                    onChange={e => setNewOfficer({ ...newOfficer, fullName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Vai trò / Chức trách</label>
                  <select
                    value={newOfficer.roleType}
                    onChange={e => setNewOfficer({ ...newOfficer, roleType: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  >
                    <option value="DEPUTY_CHIEF">Phó Chánh Văn phòng</option>
                    <option value="SPECIALIST">Chuyên viên thụ lý</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Phòng ban / Đơn vị công tác</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Phòng Tổng hợp Cấp ủy"
                    value={newOfficer.department}
                    onChange={e => setNewOfficer({ ...newOfficer, department: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    placeholder="VD: 0912345678"
                    value={newOfficer.phone}
                    onChange={e => setNewOfficer({ ...newOfficer, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Hòm thư điện tử (Email)</label>
                  <input
                    type="email"
                    placeholder="VD: hungnv@vanphong.gov.vn"
                    value={newOfficer.email}
                    onChange={e => setNewOfficer({ ...newOfficer, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Trạng thái công tác</label>
                  <select
                    value={newOfficer.status}
                    onChange={e => setNewOfficer({ ...newOfficer, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  >
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="BUSY">Đang bận công tác</option>
                    <option value="ON_LEAVE">Nghỉ phép</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddOfficer(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Lưu & Thêm nhân sự
                </button>
              </div>
            </form>
          )}

          {/* Edit Officer Modal / Form */}
          {editingOfficer && (
            <form onSubmit={handleSaveEditedOfficer} className="bg-amber-50/80 p-6 rounded-3xl border border-amber-300 shadow-md space-y-4 animate-in fade-in">
              <div className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center justify-between">
                <span>Chỉnh sửa thông tin nhân sự: {editingOfficer.fullName}</span>
                <button type="button" onClick={() => setEditingOfficer(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Họ và Tên</label>
                  <input
                    type="text"
                    required
                    value={editingOfficer.fullName}
                    onChange={e => setEditingOfficer({ ...editingOfficer, fullName: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Vai trò / Chức trách</label>
                  <select
                    value={editingOfficer.roleType}
                    onChange={e => setEditingOfficer({ ...editingOfficer, roleType: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  >
                    <option value="DEPUTY_CHIEF">Phó Chánh Văn phòng</option>
                    <option value="SPECIALIST">Chuyên viên thụ lý</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Phòng ban</label>
                  <input
                    type="text"
                    required
                    value={editingOfficer.department}
                    onChange={e => setEditingOfficer({ ...editingOfficer, department: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={editingOfficer.phone || ''}
                    onChange={e => setEditingOfficer({ ...editingOfficer, phone: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={editingOfficer.email || ''}
                    onChange={e => setEditingOfficer({ ...editingOfficer, email: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Trạng thái</label>
                  <select
                    value={editingOfficer.status}
                    onChange={e => setEditingOfficer({ ...editingOfficer, status: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                  >
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="BUSY">Đang bận công tác</option>
                    <option value="ON_LEAVE">Nghỉ phép</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOfficer(null)}
                  className="px-4 py-2 bg-white text-slate-700 rounded-xl text-xs font-bold border border-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          )}

          {/* Officers Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Họ và Tên Nhân sự</th>
                    <th className="px-5 py-3">Vai trò Chức trách</th>
                    <th className="px-5 py-3">Đơn vị / Phòng ban</th>
                    <th className="px-5 py-3">Liên hệ (Điện thoại / Email)</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredOfficers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400 italic">
                        Không tìm thấy nhân sự phù hợp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    filteredOfficers.map((officer) => (
                      <tr key={officer.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs ${
                            officer.roleType === 'DEPUTY_CHIEF' ? 'bg-indigo-600 shadow-sm' : 'bg-blue-500'
                          }`}>
                            {officer.fullName.replace('Đ/c ', '').charAt(0)}
                          </div>
                          <span>{officer.fullName}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                            officer.roleType === 'DEPUTY_CHIEF'
                              ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}>
                            {officer.roleType === 'DEPUTY_CHIEF' ? '🛡️ Phó Chánh Văn phòng' : '📋 Chuyên viên thụ lý'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-700">
                          {officer.department}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <div className="font-mono text-[11px]">{officer.phone || 'Chưa cập nhật'}</div>
                          <div className="text-[11px] text-slate-400">{officer.email || ''}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            officer.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : officer.status === 'BUSY'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              officer.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : officer.status === 'BUSY' ? 'bg-amber-500' : 'bg-slate-400'
                            }`} />
                            {officer.status === 'ACTIVE' ? 'Đang hoạt động' : officer.status === 'BUSY' ? 'Đang bận' : 'Nghỉ phép'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1">
                          {deleteConfirmId === officer.id ? (
                            <div className="inline-flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200">
                              <span className="text-[10px] font-bold text-red-700 px-1">Xóa?</span>
                              <button
                                onClick={() => deleteOfficer(officer.id)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold"
                              >
                                Có
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold"
                              >
                                Không
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingOfficer(officer)}
                                className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors inline-flex items-center"
                                title="Chỉnh sửa thông tin"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(officer.id)}
                                className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors inline-flex items-center"
                                title="Xóa nhân sự"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
