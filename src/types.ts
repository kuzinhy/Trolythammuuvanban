export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  role: 'ADMIN' | 'LEADER' | 'OFFICE' | 'STAFF' | 'VIEWER';
  department?: string;
  isActive?: boolean;
}

export interface DepartmentConfig {
  id: string;
  code: string;
  name: string;
  category: 'CAP_UY' | 'CHINH_QUYEN' | 'DOAN_THE';
  headPerson?: string;
  email?: string;
  keywords: string[];
  isDefaultLead?: boolean;
}

export interface RoutingRule {
  id: string;
  targetAuthority: string; // VD: "Ban Thường vụ", "Thường trực Cấp ủy", "Chủ tịch UBND"
  criteria: string; // Điều kiện kích hoạt
  urgencyLevel: 'HOA_TOC' | 'THUONG_KHAN' | 'BINH_THUONG';
  suggestedLeadDept: string;
  defaultDeadlineDays: number;
  isActive: boolean;
}

export interface LegalBasisItem {
  id: string;
  code: string; // VD: "Quy chế số 08-QC/TU", "Nghị định 30/2020/NĐ-CP"
  title: string;
  issuer: string;
  scope: string; // Lĩnh vực: Tổ chức cán bộ, Đất đai, Đầu tư công, Nội chính...
  summary: string;
  validFrom: string;
}

export interface AppConnectionConfig {
  connectedAppId: string;
  connectedAppUrl: string;
  appName?: string;
  connectionStatus: 'CONNECTED' | 'SYNCING' | 'DISCONNECTED' | 'CONFIGURED';
  lastSyncedAt?: string;
  sharedFirestoreProject: string;
  sharedCollections: string[];
  syncMode: 'REALTIME' | 'MANUAL';
  totalSyncedDocs?: number;
  totalSyncedTasks?: number;
  notes?: string;
}

export interface SystemConfig {
  defaultDriveFolderId: string;
  defaultDriveFolderName: string;
  preferredAiModel: 'gemini-3.1-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
  autoExtractTasksOnUpload: boolean;
  enableDriveAutoUpload: boolean;
  defaultSignerTitle: string;
  organizationName: string;
  connectedApp?: AppConnectionConfig;
}

export interface AuditLog {
  id: string;
  timestamp: any;
  userEmail: string;
  userName: string;
  action: 'UPLOAD_DOC' | 'EXTRACT_AI' | 'CREATE_TASK' | 'EXPORT_SLIP' | 'CONFIG_CHANGE' | 'LOGIN';
  detail: string;
  targetId?: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
}

export interface Document {
  id: string; // Firestore ID
  driveFileId?: string;
  driveUrl?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  fileName: string;
  mimeType?: string;
  createdTime?: string;
  createdAt?: any;

  // Administrative metadata
  documentNumber: string | null;
  documentType: string | null;
  title: string | null;
  summary: string | null;
  issuer: string | null;
  signer: string | null;
  issuedDate: string | null;
  receivedDate: string | null;
  effectiveDate: string | null;
  urgency: string | null;
  confidentiality: string | null;
  
  // Rich AI Advisory & Routing Metadata
  proposedAction: string | null; // Ví dụ: "Báo cáo Ban Thường vụ Tỉnh ủy cho ý kiến", "Giao Sở Tư pháp chủ trì tham mưu", "Chuyển Thường trực UBND chỉ đạo"
  leadDepartment: string | null; // Đơn vị chủ trì tham mưu (VD: Văn phòng Tỉnh ủy / Sở Kế hoạch & Đầu tư)
  coordinatingDepartments: string[]; // Đơn vị phối hợp
  advisoryOpinion: string | null; // Ý kiến tham mưu chi tiết trình lãnh đạo (Dự thảo phân luồng, nội dung cần chỉ đạo)
  actionDeadline: string | null; // Hạn chót xử lý / Báo cáo
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  reminderNotes?: string;
  keyDirectives: string[]; // Các chỉ đạo cốt lõi / yêu cầu trọng tâm
  legalBasis: string[]; // Căn cứ pháp lý, văn bản liên quan được viện dẫn
  suggestedDraftType: string | null; // Loại văn bản chỉ đạo đề xuất ban hành (Thông báo kết luận, Công văn chỉ đạo, Kế hoạch thực hiện)

  topics: string[];
  organizations: string[];
  persons: string[];
  deadlines: string[];
  requirements: string[];
  importantNotes: string | null;
  
  // Full-Text Search & Indexing Upgrades
  fullContent?: string | null;
  extractedTextKeywords?: string[];

  // Tags & Categorization
  tags?: string[];
  assignedDeputyChief?: string | null; // Giao cho Phó Chánh VP nào
  processingResult?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | string | null; // Kết quả: xong chưa, hay đang thực hiện

  status: 'UPLOADED' | 'ANALYZED' | 'USER_REVIEWED' | 'USER_CONFIRMED' | 'DISPATCHED';
  createdBy?: string;
  isImportant?: boolean;
  isStarred?: boolean;
  isReferenceDoc?: boolean;
  referenceCategory?: string;
  uploadedByName?: string;
  uploadedByEmail?: string;
}

export interface AssignedOfficer {
  id: string;
  fullName: string;
  roleType: 'DEPUTY_CHIEF' | 'SPECIALIST'; // Phó Chánh VP or Chuyên viên
  department: string;
  phone?: string;
  email?: string;
  status: 'ACTIVE' | 'BUSY' | 'ON_LEAVE';
}

export interface Task {
  id?: string;
  title: string;
  description: string;
  sourceDocumentId: string;
  sourceDocumentNumber: string | null;
  sourceDocumentTitle?: string | null;
  sourcePage?: string | null;
  assignedOrganization: string | null;
  suggestedResponsiblePerson?: string | null;
  collaborators?: string[];
  startDate?: string | null;
  dueDate: string | null;
  priority?: string | null;
  status: 'DRAFT' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  requiredOutput?: string | null;
  reportRequired?: boolean;
  aiReasoningSummary?: string | null;
  approvalStatus?: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  createdAt?: any;
}

