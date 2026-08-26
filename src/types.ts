export interface WardUnit {
  id: string; // e.g. 'phu-cuong', 'hiep-thanh', 'phu-hoa', 'chanh-nghia'
  code: string; // e.g. 'PHU_CUONG', 'HIEP_THANH'
  name: string; // e.g. 'Đảng ủy Phường Phú Cường'
  shortName: string; // e.g. 'Phường Phú Cường'
  parentOrg: string; // e.g. 'Thành ủy Thủ Dầu Một'
  districtName: string; // e.g. 'Thành phố Thủ Dầu Một'
  provinceName: string; // e.g. 'Tỉnh Bình Dương'
  officeAddress: string;
  contactPhone: string;
  contactEmail: string;
  technicalSupportContact?: string;
  defaultSignerTitle: string; // e.g. 'Bí thư Đảng ủy Phường'
  driveFolderId?: string;
  driveFolderName?: string;
  status: 'ACTIVE' | 'INACTIVE';
  isActive?: boolean;
  adminEmails: string[]; // Danh sách email quản trị viên của phường này
  createdAt?: string;
  stats?: {
    totalDocuments?: number;
    totalTasks?: number;
    totalOfficers?: number;
  };
}

export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'LEADER' | 'OFFICE' | 'STAFF' | 'VIEWER';
  wardId?: string; // ID đơn vị/phường trực thuộc
  wardName?: string; // Tên đơn vị/phường trực thuộc
  department?: string;
  isActive?: boolean;
}

export interface UserPermissionProfile {
  uid: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'LEADER' | 'OFFICE' | 'STAFF' | 'VIEWER';
  roleTitle: string; // VD: Bí thư Đảng ủy, Phó Bí thư Thường trực, Chánh VP Cấp ủy...
  department: string; // VD: Văn phòng Đảng ủy, Ban Tổ chức, Chi bộ Khu phố 1...
  wardId?: string; // ID phường/đơn vị (hoặc 'all' cho SuperAdmin)
  wardName?: string; // Tên phường/đơn vị
  status: 'ACTIVE' | 'LOCKED' | 'PENDING';
  phone?: string;
  permissions: {
    viewSecretDocs: boolean; // Xem văn bản Mật / Nội bộ Cấp ủy
    approveDrafts: boolean; // Phê duyệt dự thảo & Ký số Phiếu Tham mưu
    trainAI: boolean; // Huấn luyện & Nạp tri thức Bộ não AI
    manageSchedule: boolean; // Phê duyệt Lịch công tác Thường trực
    assignTasks: boolean; // Giao & Đôn đốc nhiệm vụ Chi bộ / Ban ngành
    systemAdmin: boolean; // Quản trị hệ thống & Cấu hình CSDL
    exportReports: boolean; // Xuất báo cáo thống kê định kỳ
    auditDocumentFormat: boolean; // Rà soát thể thức văn bản Đảng
  };
  lastActiveAt?: string;
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
  wardId?: string;
}

export interface RoutingRule {
  id: string;
  targetAuthority: string; // VD: "Ban Thường vụ", "Thường trực Cấp ủy", "Chủ tịch UBND"
  criteria: string; // Điều kiện kích hoạt
  urgencyLevel: 'HOA_TOC' | 'THUONG_KHAN' | 'BINH_THUONG';
  suggestedLeadDept: string;
  defaultDeadlineDays: number;
  isActive: boolean;
  ruleName?: string;
  department?: string;
  keywords?: string[];
  wardId?: string;
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
  wardId?: string; // ID đơn vị phường liên kết
  // Ward Administrative Entity Metadata
  wardName?: string; // VD: "Đảng ủy Phường Phú Cường"
  districtName?: string; // VD: "Thành phố Thủ Dầu Một"
  provinceName?: string; // VD: "Tỉnh Bình Dương"
  parentOrganization?: string; // VD: "Thành ủy Thủ Dầu Một"
  officeAddress?: string; // VD: "Số 01 Đường Cách Mạng Tháng Tám, Phường Phú Cường"
  contactPhone?: string; // VD: "0274 3822 123"
  contactEmail?: string; // VD: "vanphong.danguy@phucuong.gov.vn"
  technicalSupportContact?: string; // VD: "Đ/c Nguyễn Huy - Chuyên viên CNTT (0912.345.678)"

  // Document Priority & Processing Rules
  normalDocDeadlineDays?: number; // Mặc định 3 ngày
  urgentDocDeadlineHours?: number; // Mặc định 24 giờ
  superUrgentDocDeadlineHours?: number; // Mặc định 4 giờ
  reminderBeforeHours?: number; // Nhắc trước 12 giờ
  autoAssignEnabled?: boolean; // Tự động gợi ý phân luồng
  strictSecretMode?: boolean; // Kiểm soát nghiêm ngặt văn bản mật

  // Storage & Cloud Sync
  defaultDriveFolderId: string;
  defaultDriveFolderName: string;
  enableDriveAutoUpload: boolean;

  // AI & Drafting Configuration
  preferredAiModel: 'gemini-3.1-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
  autoExtractTasksOnUpload: boolean;
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
  isProcessed?: boolean;

  status: 'UPLOADED' | 'ANALYZED' | 'USER_REVIEWED' | 'USER_CONFIRMED' | 'DISPATCHED';
  createdBy?: string;
  isImportant?: boolean;
  isStarred?: boolean;
  isReferenceDoc?: boolean;
  referenceCategory?: string;
  uploadedByName?: string;
  uploadedByEmail?: string;
  wardId?: string; // ID Đơn vị / Phường
  wardName?: string; // Tên Đơn vị / Phường
}

export interface AssignedOfficer {
  id: string;
  fullName: string;
  roleType: 'DEPUTY_CHIEF' | 'SPECIALIST'; // Phó Chánh VP or Chuyên viên
  department: string;
  phone?: string;
  email?: string;
  status: 'ACTIVE' | 'BUSY' | 'ON_LEAVE';
  wardId?: string; // ID Đơn vị / Phường
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
  assignee?: string | null;
  assignedTo?: string | null;
  assigneeId?: string | null;
  documentId?: string;
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
  wardId?: string; // ID Đơn vị / Phường
  wardName?: string; // Tên Đơn vị / Phường
}

