import React, { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  Sparkles, Loader2, Copy, Check, BookOpen, AlertCircle, 
  FileText, CheckCircle2, Trash2, Search, RotateCcw, ClipboardCheck, ArrowUpRight,
  ShieldCheck, History, Edit3, Save, Printer, Download, ExternalLink,
  ChevronDown, ChevronUp, FolderGit2, Eye, X, BrainCircuit, Users, Send,
  HelpCircle, Calendar, Zap, AlertTriangle, Layers, ListOrdered, CheckSquare
} from 'lucide-react';
import { 
  db, 
  TARGET_DRIVE_FOLDER_ID, 
  TARGET_DRIVE_FOLDER_URL,
  SAMPLE_CONCLUSION_DOC_ID,
  SAMPLE_CONCLUSION_DOC_URL,
  SAMPLE_CONCLUSION_DOC_PREVIEW_URL
} from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuthStore } from '../store/authStore';

interface DraftResult {
  option1: string;
  option2: string;
  styleDescription1: string;
  styleDescription2: string;
}

export interface RaciTask {
  id: string;
  title: string;
  description: string;
  responsible: string;
  accountable: string;
  consulted: string;
  informed: string;
  suggestedDueDate: string;
  priority: 'KHẨN' | 'CAO' | 'TRUNG BÌNH';
  expectedOutput: string;
  suggestedReminders: string;
}

export interface RaciExtractionResult {
  executiveSummary: string;
  raciTasks: RaciTask[];
  automatedReminderNotice: string;
}

export interface MeetingBriefingResult {
  briefingTitle: string;
  situationOverview: string[];
  hotspotAlerts: { location: string; issue: string; riskLevel: string; recommendationForSecretary: string }[];
  pendingDirectivesReview: { directiveName: string; assignedUnit: string; progressStatus: string; bottleneck: string }[];
  suggestedAgenda: { order: number; timeAllocated: string; topic: string; reporter: string }[];
  sharpInterrogationQuestions: { targetAudience: string; question: string; purpose: string }[];
  draftConclusionPoints: string[];
}

export interface DeepDriveLearnResult {
  syncStatus: string;
  learnedAt: string;
  executiveVocabularyBank: { category: string; phrases: string[]; usageContext: string }[];
  learnedPrecedents: { resolutionCode: string; coreSubject: string; keyLessonLearned: string; applicableScenarios: string[] }[];
  executiveStyleRules: string[];
  systemReadinessIndex: number;
}

interface DraftVersionSnapshot {
  id: string;
  title: string;
  content: string;
  style: string;
  timestamp: string;
}

interface DirectiveHistoryItem {
  id: string;
  idea: string;
  selectedOptionText: string;
  style: string;
  createdAt: any;
}

interface Resolution {
  id: string;
  code: string;
  title: string;
  governingBody: string;
  keyKeywords: string[];
  coreContent: string;
}

interface HotSpot {
  id: string;
  icon: string;
  title: string;
  location: string;
  ideaTemplate: string;
}

interface PreviousConclusionNotice {
  id: string;
  code: string;
  title: string;
  meetingDate: string;
  category: string;
  summary: string;
  paragraphExcerpt: string;
  driveUrl: string;
}

const DOCUMENT_TYPES = [
  { id: 'CONCLUSION', label: 'Thông báo Kết luận', desc: 'Kết luận cuộc họp Thường trực / Ban Thường vụ Đảng ủy phường' },
  { id: 'ENDORSEMENT', label: 'Ý kiến Bút phê', desc: 'Bút phê chỉ đạo trực tiếp phân luồng xử lý văn bản đến' },
  { id: 'DIRECTIVE', label: 'Chỉ thị Cấp ủy', desc: 'Chỉ thị của Đảng ủy phường về các nhiệm vụ trọng tâm' },
  { id: 'RESOLUTION', label: 'Nghị quyết Chuyên đề', desc: 'Nghị quyết chuyên đề của Đảng ủy chỉ đạo hệ thống chính trị' },
];

const MEETING_CONTEXTS = [
  { id: 'BTV_REGULAR', label: 'Hội nghị Ban Thường vụ Đảng ủy định kỳ' },
  { id: 'THUONG_TRUC_BRIEFING', label: 'Giao ban Thường trực Đảng ủy với UBND & Công an' },
  { id: 'ON_SITE_INSPECTION', label: 'Kết luận kiểm tra thực địa & Điểm nóng địa bàn' },
  { id: 'MASS_MOBILIZATION', label: 'Giao ban Khối Dân vận - Mặt trận & Chi bộ Khu phố' },
  { id: 'DIGITAL_REFORM', label: 'Chuyên đề Cải cách TTHC, Đề án 06 & Chuyển đổi số' },
];

const WARD_HOTSPOTS: HotSpot[] = [
  {
    id: 'spot-1',
    icon: '🏙️',
    title: 'Trật tự Đô thị & Lòng lề đường',
    location: 'Tuyến đường trọng điểm & Khu vực Chợ Phường',
    ideaTemplate: 'Tăng cường tuần tra, kiên quyết xử lý dứt điểm tình trạng lấn chiếm lòng lề đường kinh doanh tự phát xung quanh chợ và các tuyến đường chính. Giao UBND phường chủ trì, Công an phường lập chốt trực chéo kiên quyết không để tái diễn.'
  },
  {
    id: 'spot-2',
    icon: '🔥',
    title: 'An toàn PCCC & Cứu nạn Cứu hộ',
    location: 'Nhà trọ mật độ cao & Chung cư cũ',
    ideaTemplate: 'Chỉ đạo tổng rà soát an toàn PCCC các cơ sở nhà trọ mật độ cao, chung cư cũ và cơ sở kinh doanh có điều kiện. Yêu cầu trang bị 100% bình chữa cháy, mở lối thoát nạn thứ 2 và tổ chức diễn tập PCCC tại từng khu phố.'
  },
  {
    id: 'spot-3',
    icon: '💻',
    title: 'Cải cách TTHC & Đề án 06 / VNeID',
    location: 'Bộ phận Tiếp nhận & Trả kết quả Một cửa',
    ideaTemplate: 'Đẩy mạnh dịch vụ công trực tuyến toàn trình và kích hoạt tài khoản VNeID mức 2 cho người dân. Giao UBND phường số hóa 100% hồ sơ tiếp nhận, Đoàn Thanh niên duy trì tổ thanh niên tình nguyện hỗ trợ tại Bộ phận Một cửa.'
  },
  {
    id: 'spot-4',
    icon: '🚩',
    title: 'Công tác Xây dựng Đảng & Chi bộ',
    location: 'Chi bộ các Khu phố & Cơ quan',
    ideaTemplate: 'Nâng cao chất lượng sinh hoạt chi bộ định kỳ và sinh hoạt chuyên đề; tăng cường phân công đảng viên phụ trách hộ gia đình; chủ động nắm bắt tâm tư nhân dân và phát triển đảng viên mới đạt chỉ tiêu Quận ủy giao.'
  },
  {
    id: 'spot-5',
    icon: '🏗️',
    title: 'GPMB & Đầu tư Hạ tầng Cơ sở',
    location: 'Dự án hạ tầng giao thông & chỉnh trang đô thị',
    ideaTemplate: 'Tập trung công tác bồi thường, hỗ trợ, giải phóng mặt bằng các dự án trọng điểm. Khối Dân vận, Mặt trận Tổ quốc và các đoàn thể đi trước nắm tình hình, kiên trì tuyên truyền, vận động tạo sự đồng thuận cao của người dân.'
  },
  {
    id: 'spot-6',
    icon: '🤝',
    title: 'An sinh Xã hội & Đời sống Dân sinh',
    location: 'Hộ nghèo, đối tượng chính sách toàn địa bàn',
    ideaTemplate: 'Tập trung rà soát, chăm lo kịp thời cho các gia đình chính sách, người có công và hộ có hoàn cảnh khó khăn; khẩn trương giải quyết dứt điểm các kiến nghị bức xúc của cử tri tại các buổi tiếp xúc cơ sở.'
  }
];

const PREVIOUS_CONCLUSION_NOTICES: PreviousConclusionNotice[] = [
  {
    id: 'tb-gdocs-sample',
    code: 'Mẫu Google Docs',
    title: 'Thông báo Kết luận Thường trực Đảng ủy Phường (Văn bản Mẫu Chuẩn Google Docs)',
    meetingDate: 'Mẫu Chuẩn Cấp Ủy (Google Docs ID: 1uzKq-XB69np2ElcHje3qznYco_uxWc1PHCv-cKUgfUQ)',
    category: 'Mẫu Chuẩn Google Docs',
    summary: 'Mẫu Thông báo kết luận chuẩn của Bí thư Đảng ủy / Thường trực Đảng ủy với cấu trúc 4 đoạn văn mẫu mực chỉ đạo toàn diện hệ thống chính trị cơ sở.',
    paragraphExcerpt: `Đánh giá toàn diện công tác lãnh đạo, chỉ đạo thời gian qua; khẳng định quyết tâm chính trị của toàn Đảng bộ trong việc giải quyết dứt điểm các vấn đề trọng tâm, trọng điểm, bức xúc dân sinh trên địa bàn phường.

Giao Ủy ban nhân dân phường, trực tiếp là đồng chí Chủ tịch UBND phường chỉ đạo các bộ phận chuyên môn, Công an phường và các lực lượng liên quan khẩn trương triển khai đồng bộ các giải pháp; siết chặt kỷ luật, kỷ cương hành chính công vụ, xử lý nghiêm minh các hành vi vi phạm.

Đề nghị Khối Dân vận, Ủy ban MTTQ và các đoàn thể chính trị - xã hội phối hợp chặt chẽ với Cấp ủy các Chi bộ khu phố đẩy mạnh công tác tuyên truyền, vận động, phát huy sức mạnh khối đại đoàn kết toàn dân và tinh thần tiền phong gương mẫu của cán bộ, đảng viên.

Giao Văn phòng Đảng ủy chủ trì, phối hợp với Ủy ban Kiểm tra Đảng ủy thường xuyên theo dõi, đôn đốc, giám sát tiến độ thực hiện và tổng hợp báo cáo Thường trực Đảng ủy theo quy định.`,
    driveUrl: `${SAMPLE_CONCLUSION_DOC_URL}`
  },
  {
    id: 'tb-42',
    code: 'Thông báo số 42-TB/ĐU',
    title: 'Kết luận của Thường trực Đảng ủy về tăng cường quản lý trật tự đô thị, vệ sinh môi trường và chống lấn chiếm vỉa hè',
    meetingDate: 'Kỳ họp Thường trực Đảng ủy tháng 02/2026',
    category: 'Đô thị - Môi trường',
    summary: 'Đánh giá công tác lập lại trật tự đô thị, giao Chủ tịch UBND phường chỉ đạo tổ liên ngành tuần tra thường xuyên, gắn trách nhiệm người đứng đầu chi bộ khu phố.',
    paragraphExcerpt: `Đánh giá thẳng thắn công tác lập lại trật tự đô thị thời gian qua đã có chuyển biến tích cực nhưng chưa thực sự căn cơ, bền vững, còn tình trạng buôn bán lấn chiếm lòng lề đường tại một số tuyến trọng điểm. Thường trực Đảng ủy yêu cầu toàn hệ thống chính trị vào cuộc với tinh thần quyết liệt, không có vùng cấm.

Giao Ủy ban nhân dân phường, trực tiếp là đồng chí Chủ tịch UBND phường chỉ đạo lực lượng Công an, Đội Quản lý trật tự đô thị thành lập các tổ công tác kiểm tra liên tục 24/7; kiên quyết xử lý nghiêm minh các trường hợp cố tình tái phạm, thu hồi giấy phép đối với các cơ sở kinh doanh lấn chiếm vỉa hè gây cản trở giao thông.

Đề nghị Khối Dân vận, Ủy ban Mặt trận Tổ quốc và các đoàn thể chính trị - xã hội phối hợp chặt chẽ với Chi bộ các khu phố tổ chức tuyên truyền, vận động 100% hộ kinh doanh mặt đường ký cam kết tự giác chấp hành; phát huy vai trò giám sát của nhân dân và trách nhiệm nêu gương của từng cán bộ, đảng viên tại khu dân cư.

Giao Văn phòng Đảng ủy chủ trì, phối hợp với Ủy ban Kiểm tra Đảng ủy thường xuyên kiểm tra công vụ, theo dõi tiến độ xử lý và tổng hợp báo cáo Thường trực Đảng ủy vào thứ Sáu hàng tuần.`,
    driveUrl: `${TARGET_DRIVE_FOLDER_URL}`
  },
  {
    id: 'tb-58',
    code: 'Thông báo số 58-TB/ĐU',
    title: 'Kết luận của Ban Thường vụ Đảng ủy về đẩy mạnh cải cách hành chính, thực hiện Đề án 06 và chuyển đổi số phục vụ nhân dân',
    meetingDate: 'Hội nghị BTV Đảng ủy chuyên đề Quý I/2026',
    category: 'Cải cách Hành chính',
    summary: 'Siết chặt kỷ luật kỷ cương công vụ tại Bộ phận Một cửa, hoàn thành kích hoạt VNeID mức 2, không để xảy ra tình trạng hồ sơ trễ hạn.',
    paragraphExcerpt: `Ban Thường vụ Đảng ủy ghi nhận những nỗ lực ban đầu của UBND phường trong công tác chuyển đổi số và phục vụ người dân tại Bộ phận Tiếp nhận và Trả kết quả. Tuy nhiên, tỷ lệ giải quyết dịch vụ công trực tuyến toàn trình chưa đồng đều, tinh thần phục vụ của một số công chức chuyên môn chưa thật sự chủ động.

Yêu cầu Ủy ban nhân dân phường khẩn trương rà soát, tinh gọn toàn bộ quy trình tiếp nhận, xử lý hồ sơ hành chính; quán triệt phương châm "Lấy sự hài lòng của người dân làm thước đo đánh giá cán bộ", kiên quyết không để xảy ra bất kỳ hồ sơ nào trễ hạn mà không có thư xin lỗi kèm lý do chính đáng.

Giao Đoàn Thanh niên phường chủ trì, phối hợp cùng Cấp ủy các chi bộ khu phố duy trì hoạt động của Tổ Công nghệ số cộng đồng, "đi từng ngõ, gõ từng nhà" để hướng dẫn, hỗ trợ nhân dân cài đặt và sử dụng thành thạo các tiện ích trên ứng dụng VNeID.

Giao Ban Tuyên giáo phối hợp Văn phòng Đảng ủy đẩy mạnh truyền thông trên các kênh thông tin chính thống của phường; định kỳ hàng tháng báo cáo Thường trực Đảng ủy về chỉ số hài lòng của người dân.`,
    driveUrl: `${TARGET_DRIVE_FOLDER_URL}`
  },
  {
    id: 'tb-76',
    code: 'Thông báo số 76-TB/ĐU',
    title: 'Kết luận của Thường trực Đảng ủy về tổng rà soát an toàn PCCC đối với nhà trọ mật độ cao và chung cư cũ',
    meetingDate: 'Giao ban Cấp ủy đột xuất',
    category: 'An ninh - PCCC',
    summary: 'Yêu cầu mở lối thoát nạn thứ 2, trang bị 100% bình chữa cháy cho hộ dân, đình chỉ ngay các cơ sở vi phạm nghiêm trọng.',
    paragraphExcerpt: `Xác định công tác phòng cháy, chữa cháy và cứu nạn, cứu hộ là nhiệm vụ trọng yếu, cấp bách liên quan trực tiếp đến tính mạng và tài sản của nhân dân. Thường trực Đảng ủy yêu cầu tuyệt đối không được chủ quan, lơ là hoặc buông lỏng quản lý địa bàn.

Giao Công an phường chủ trì, phối hợp UBND phường tổng rà soát 100% các cơ sở kinh doanh dịch vụ cho thuê trọ mật độ cao, chung cư nhiều tầng nhiều căn hộ và cơ sở kinh doanh có điều kiện; kiên quyết yêu cầu mở lối thoát nạn thứ 2, trang bị đầy đủ phương tiện chữa cháy tại chỗ và tạm đình chỉ ngay các cơ sở không bảo đảm an toàn theo quy định.

Đề nghị Ủy ban Mặt trận Tổ quốc và các đoàn thể phường phát động sâu rộng phong trào "Nhà tôi có bình chữa cháy", vận động xã hội hóa trao tặng bình chữa cháy cho các hộ nghèo, cận nghèo; hướng dẫn từng hộ gia đình tự trang bị kỹ năng thoát hiểm khi có sự cố.

Giao đồng chí Trưởng Công an phường chịu trách nhiệm toàn diện trước Thường trực Đảng ủy nếu để xảy ra vi phạm nghiêm trọng về an toàn PCCC trên địa bàn được phân công phụ trách.`,
    driveUrl: `${TARGET_DRIVE_FOLDER_URL}`
  },
  {
    id: 'tb-91',
    code: 'Thông báo số 91-TB/ĐU',
    title: 'Kết luận của Bí thư Đảng ủy về công tác bồi thường, giải phóng mặt bằng các dự án giao thông trọng điểm',
    meetingDate: 'Hội nghị Giao ban Thường trực Đảng ủy',
    category: 'Kinh tế - Đầu tư',
    summary: 'Phát huy công tác Dân vận khéo, đối thoại thỏa đáng với các hộ dân chưa đồng thuận, bảo đảm quyền lợi hợp pháp của người dân.',
    paragraphExcerpt: `Khẳng định công tác bồi thường, hỗ trợ, tái định cư và giải phóng mặt bằng các dự án giao thông trọng điểm là nhiệm vụ chính trị trọng tâm, có ý nghĩa quyết định đối với sự phát triển kinh tế - xã hội lâu dài của toàn phường.

Yêu cầu Hội đồng bồi thường, giải phóng mặt bằng và UBND phường khẩn trương công khai, minh bạch các phương án áp giá đền bù theo đúng quy định pháp luật; kịp thời tiếp nhận, giải quyết thỏa đáng các kiến nghị chính đáng của bà con nhân dân, tuyệt đối không để phát sinh khiếu kiện đông người.

Khối Dân vận Đảng ủy, Ủy ban MTTQ và Ban Công tác Mặt trận các khu phố có dự án đi qua phải "đi trước một bước", kiên trì tuyên truyền, vận động, giải thích rõ chủ trương, tạo sự đồng thuận tự giác bàn giao mặt bằng của các hộ dân; phân công đảng viên uy tín trực tiếp phụ trách các trường hợp còn băn khoăn.

Giao Văn phòng Đảng ủy cập nhật tiến độ giải phóng mặt bằng hàng ngày, báo cáo đồng chí Bí thư Đảng ủy để kịp thời chỉ đạo tháo gỡ các vướng mắc phát sinh từ thực tiễn.`,
    driveUrl: `${TARGET_DRIVE_FOLDER_URL}`
  },
  {
    id: 'tb-105',
    code: 'Thông báo số 105-TB/ĐU',
    title: 'Kết luận của Ban Thường vụ Đảng ủy về nâng cao năng lực lãnh đạo và chất lượng sinh hoạt Chi bộ khu phố',
    meetingDate: 'Hội nghị BTV Đảng ủy tháng 01/2026',
    category: 'Xây dựng Đảng',
    summary: 'Đổi mới sinh hoạt chi bộ gắn với giải quyết việc nóng của khu dân cư, nâng cao vai trò tiền phong gương mẫu của đảng viên.',
    paragraphExcerpt: `Ban Thường vụ Đảng ủy đánh giá cao tinh thần trách nhiệm của Cấp ủy các chi bộ khu phố thời gian qua. Tuy nhiên, nội dung sinh hoạt tại một số chi bộ còn nặng về phổ biến văn bản, tính chiến đấu và việc bàn giải pháp tháo gỡ các khó khăn, vướng mắc dân sinh tại khu phố còn hạn chế.

Yêu cầu các đồng chí Đảng ủy viên phụ trách khu phố nghiêm túc dự sinh hoạt định kỳ tại chi bộ; hướng dẫn Cấp ủy chi bộ đổi mới mạnh mẽ nội dung, hình thức sinh hoạt theo hướng bám sát đời sống thực tế, giải quyết dứt điểm các phản ánh của quần chúng nhân dân tại địa bàn.

Cấp ủy các chi bộ khẩn trương rà soát nguồn quần chúng ưu tú, đặc biệt là lực lượng đoàn viên, thanh niên xung kích, lực lượng bảo vệ an ninh trật tự cơ sở và nhân viên y tế để bồi dưỡng, kết nạp Đảng, phấn đấu hoàn thành và vượt chỉ tiêu kết nạp đảng viên năm 2026.

Giao Ban Tổ chức Đảng ủy phối hợp Ủy ban Kiểm tra Đảng ủy thường xuyên giám sát chuyên đề đối với công tác sinh hoạt chi bộ và phân công đảng viên làm công tác dân vận.`,
    driveUrl: `${TARGET_DRIVE_FOLDER_URL}`
  }
];

const LEVEL_RESOLUTIONS: Resolution[] = [
  {
    id: 'res-1',
    code: 'Nghị quyết số 05-NQ/QU',
    title: 'Nghị quyết Quận ủy về quản lý hành lang đô thị và kỷ cương vỉa hè',
    governingBody: 'Quận ủy ban hành',
    keyKeywords: ['trật tự', 'đô thị', 'lòng đường', 'vỉa hè', 'lấn chiếm', 'chợ', 'đường', 'hành lang'],
    coreContent: 'Xử lý triệt để lấn chiếm vỉa hè kinh doanh, giải tỏa các điểm họp chợ tự phát cản trở an toàn giao thông.'
  },
  {
    id: 'res-2',
    code: 'Nghị quyết số 18-NQ/TU',
    title: 'Nghị quyết Thành ủy về an toàn PCCC và vệ sinh môi trường đô thị',
    governingBody: 'Thành ủy ban hành',
    keyKeywords: ['môi trường', 'rác', 'thoát nước', 'phòng cháy', 'chữa cháy', 'pccc', 'chung cư', 'nhà trọ', 'an toàn điện'],
    coreContent: 'Bảo đảm an toàn PCCC tại các khu dân cư đông đúc, nhà trọ cho thuê và ngăn ngừa cháy nổ.'
  },
  {
    id: 'res-3',
    code: 'Nghị quyết số 12-NQ/QU',
    title: 'Nghị quyết Quận ủy về chuyển đổi số và nâng cao hiệu quả hành chính Một cửa',
    governingBody: 'Quận ủy ban hành',
    keyKeywords: ['số', 'số hóa', 'công nghệ', 'vneid', 'cải cách', 'thủ tục', 'hành chính', 'một cửa', 'đề án 06'],
    coreContent: 'Số hóa hồ sơ thủ tục hành chính, cải cách quy trình tiếp nhận và nâng cao tỷ lệ giải quyết trực tuyến.'
  }
];

const DIRECTIVE_QUICK_TAGS = [
  { label: 'Giao UBND phường', text: 'Giao UBND phường (Chủ tịch UBND chỉ đạo): ' },
  { label: 'Giao Công an phường', text: 'Giao Công an phường phối hợp: ' },
  { label: 'Khối Dân vận - MTTQ', text: 'Đề nghị Khối Dân vận, Ủy ban MTTQ và các đoàn thể phường: ' },
  { label: 'Chi bộ Khu phố', text: 'Yêu cầu Cấp ủy các Chi bộ khu phố: ' },
  { label: 'Hạn báo cáo', text: 'Báo cáo Thường trực Đảng ủy trước ngày ...' },
];

export default function DirectiveDrafting() {
  const [idea, setIdea] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('CONCLUSION');
  const [selectedMeetingContext, setSelectedMeetingContext] = useState(MEETING_CONTEXTS[0].label);
  const [selectedHotSpot, setSelectedHotSpot] = useState<HotSpot | null>(null);
  const [selectedNoticeReference, setSelectedNoticeReference] = useState<PreviousConclusionNotice | null>(null);
  const [showDriveArchive, setShowDriveArchive] = useState(false);
  const [driveSearchTerm, setDriveSearchTerm] = useState('');
  const [showDocModal, setShowDocModal] = useState(false);
  
  // Intelligent Feature 1: RACI Matrix Extraction States
  const [showRaciModal, setShowRaciModal] = useState(false);
  const [isExtractingRaci, setIsExtractingRaci] = useState(false);
  const [raciResult, setRaciResult] = useState<RaciExtractionResult | null>(null);
  const [isSavingRaciTasks, setIsSavingRaciTasks] = useState(false);
  const [savedRaciSuccess, setSavedRaciSuccess] = useState(false);

  // Intelligent Feature 2: Smart Meeting Briefing & Interrogation Questions States
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [briefingMeetingType, setBriefingMeetingType] = useState('Hội nghị Ban Thường vụ Đảng ủy định kỳ');
  const [briefingFocus, setBriefingFocus] = useState('Tập trung siết chặt kỷ luật công vụ, tháo gỡ dứt điểm điểm nóng trật tự đô thị và PCCC');
  const [briefingResult, setBriefingResult] = useState<MeetingBriefingResult | null>(null);

  // Intelligent Feature 4: Deep Drive Brain Knowledge Engine States
  const [showDriveBrainModal, setShowDriveBrainModal] = useState(false);
  const [isLearningBrain, setIsLearningBrain] = useState(false);
  const [driveBrainResult, setDriveBrainResult] = useState<DeepDriveLearnResult | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedOptionTab, setSelectedOptionTab] = useState<'option1' | 'option2'>('option1');
  const [preferredStyle, setPreferredStyle] = useState<string>('Văn phong đoạn văn lãnh đạo Cấp ủy: Sâu sắc, uy quyền, đanh thép, chuẩn chính trị');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'result' | 'versions' | 'history'>('result');

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState('');

  // Version History states
  const [draftVersions, setDraftVersions] = useState<DraftVersionSnapshot[]>([]);

  // History states
  const [historyItems, setHistoryItems] = useState<DirectiveHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const { user } = useAuthStore();

  const recordVersion = (title: string, content: string, style: string) => {
    const newVer: DraftVersionSnapshot = {
      id: 'v-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      title,
      content,
      style,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setDraftVersions(prev => [newVer, ...prev.slice(0, 14)]);
  };

  const handleRestoreVersion = (ver: DraftVersionSnapshot) => {
    if (!result) return;
    if (selectedOptionTab === 'option2') {
      setResult({
        ...result,
        option2: ver.content,
        styleDescription2: ver.style
      });
      setEditableContent(ver.content);
    } else {
      setResult({
        ...result,
        option1: ver.content,
        styleDescription1: ver.style
      });
      setEditableContent(ver.content);
    }
    setSuccessMsg(`Đã khôi phục phiên bản: "${ver.title}" (${ver.timestamp})`);
    setTimeout(() => setSuccessMsg(null), 3000);
    setActiveRightTab('result');
  };

  // Dynamic Resolution Matching
  const matchingResolutions = useMemo(() => {
    if (!idea.trim()) return [];
    const normalizedIdea = idea.toLowerCase();
    return LEVEL_RESOLUTIONS.filter(res => {
      return res.keyKeywords.some(keyword => normalizedIdea.includes(keyword));
    });
  }, [idea]);

  // Filtered Google Drive Previous Notices
  const filteredNotices = useMemo(() => {
    if (!driveSearchTerm.trim()) return PREVIOUS_CONCLUSION_NOTICES;
    const term = driveSearchTerm.toLowerCase();
    return PREVIOUS_CONCLUSION_NOTICES.filter(n => 
      n.code.toLowerCase().includes(term) ||
      n.title.toLowerCase().includes(term) ||
      n.category.toLowerCase().includes(term) ||
      n.summary.toLowerCase().includes(term)
    );
  }, [driveSearchTerm]);

  useEffect(() => {
    let isMounted = true;
    const historyQuery = query(
      collection(db, 'directive_history'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      if (!isMounted) return;
      const items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as DirectiveHistoryItem));
      setHistoryItems(items);
    }, (err) => {
      console.error("Error syncing directive history:", err);
    });

    const savedStyle = localStorage.getItem('preferred_draft_style_desc');
    if (savedStyle && isMounted) {
      setPreferredStyle(savedStyle);
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // When result or tab changes, sync editable content
  useEffect(() => {
    if (result) {
      setEditableContent(selectedOptionTab === 'option1' ? result.option1 : result.option2);
      setIsEditing(false);
    }
  }, [result, selectedOptionTab]);

  const filteredHistory = useMemo(() => {
    const term = historySearch.toLowerCase().trim();
    if (!term) return historyItems;
    return historyItems.filter(item => 
      (item.idea || '').toLowerCase().includes(term) ||
      (item.selectedOptionText || '').toLowerCase().includes(term) ||
      (item.style || '').toLowerCase().includes(term)
    );
  }, [historyItems, historySearch]);

  const handleSelectHotSpot = (spot: HotSpot) => {
    setSelectedHotSpot(spot);
    setIdea(spot.ideaTemplate);
    setSuccessMsg(`Đã chọn nội dung mẫu: "${spot.title}"`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleSelectNoticeAsReference = (notice: PreviousConclusionNotice) => {
    setSelectedNoticeReference(notice);
    setSuccessMsg(`Đã nạp ngữ cảnh văn phong từ: ${notice.code}`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleApplyNoticeTemplateToIdea = (notice: PreviousConclusionNotice) => {
    setSelectedNoticeReference(notice);
    setIdea(`Tham mưu triển khai theo tinh thần ${notice.code} (${notice.title}):\n${notice.summary}`);
    setSuccessMsg(`Đã điền nội dung từ ${notice.code} vào ô chỉ đạo!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAppendTag = (tagText: string) => {
    setIdea(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return tagText;
      return `${trimmed}\n- ${tagText}`;
    });
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setIsGenerating(true);
    setError(null);
    setSuccessMsg(null);
    setIsEditing(false);

    try {
      const driveKnowledgeContext = selectedNoticeReference 
        ? `Tham chiếu văn phong từ Thông báo kết luận thực tế: "${selectedNoticeReference.code} - ${selectedNoticeReference.title}". Mẫu đoạn văn: "${selectedNoticeReference.paragraphExcerpt.substring(0, 300)}..."`
        : undefined;

      const res = await fetch('/api/draft-directive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(),
          documentType: selectedDocType,
          meetingContext: selectedMeetingContext,
          stylePreference: preferredStyle,
          matchedResolutions: matchingResolutions.map(r => `${r.code}: ${r.title}`),
          driveKnowledgeContext,
          paragraphFormat: 'PARAGRAPH_EXECUTIVE'
        })
      });

      if (!res.ok) throw new Error("Yêu cầu tạo văn bản chỉ đạo thất bại");
      const data: DraftResult = await res.json();
      setResult(data);
      setSelectedOptionTab('option1');
      setEditableContent(data.option1);
      recordVersion('Phương án 1 (Quyết liệt - Kỷ cương)', data.option1, data.styleDescription1);
      recordVersion('Phương án 2 (Đồng bộ - Dân vận khéo)', data.option2, data.styleDescription2);
      setActiveRightTab('result');
      
      // Auto save the primary option to history
      try {
        await addDoc(collection(db, 'directive_history'), {
          idea: idea.trim(),
          selectedOptionText: data.option1,
          style: data.styleDescription1,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null
        });
      } catch (saveErr) {
        console.warn("Auto save history error:", saveErr);
      }

      setSuccessMsg("Đã hoàn thành tham mưu ý kiến chỉ đạo theo các đoạn văn chuẩn phong cách Bí thư Đảng ủy!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi kết nối với máy chủ AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveInlineEdit = () => {
    if (!result) return;
    if (selectedOptionTab === 'option1') {
      setResult({ ...result, option1: editableContent });
      recordVersion('Chỉnh sửa tay (Phương án 1)', editableContent, result.styleDescription1);
    } else {
      setResult({ ...result, option2: editableContent });
      recordVersion('Chỉnh sửa tay (Phương án 2)', editableContent, result.styleDescription2);
    }
    setIsEditing(false);
    setSuccessMsg("Đã cập nhật nội dung chỉnh sửa trực tiếp!");
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleDeleteHistory = async (id: string, e: any) => {
    e.stopPropagation();
    setIsDeletingId(id);
    try {
      await deleteDoc(doc(db, 'directive_history', id));
    } catch (err) {
      console.error("Error deleting history doc:", err);
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleReuseHistory = (item: DirectiveHistoryItem) => {
    setIdea(item.idea);
    setResult({
      option1: item.selectedOptionText,
      option2: item.selectedOptionText,
      styleDescription1: item.style,
      styleDescription2: "Phương án bổ trợ"
    });
    setSelectedOptionTab('option1');
    setEditableContent(item.selectedOptionText);
    recordVersion('Tái sử dụng: ' + item.style, item.selectedOptionText, item.style);
    setActiveRightTab('result');
    setSuccessMsg("Đã tải lại nội dung chỉ đạo từ sổ tay nhật ký.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setSuccessMsg("Đã sao chép toàn bộ nội dung văn bản chỉ đạo!");
      setTimeout(() => {
        setCopiedText(null);
        setSuccessMsg(null), 2500;
      }, 2500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const handleExportDoc = (text: string) => {
    const header = `ĐẢNG ỦY PHƯỜNG\nTHƯỜNG TRỰC ĐẢNG ỦY\n***\n\n${DOCUMENT_TYPES.find(d => d.id === selectedDocType)?.label.toUpperCase() || 'Ý KIẾN CHỈ ĐẠO CỦA BÍ THƯ ĐẢNG ỦY'}\nBối cảnh: ${selectedMeetingContext}\n\n`;
    const fullText = header + text;
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Y_Kien_Chi_Dao_Bi_Thu_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccessMsg("Đã tải tệp văn bản chỉ đạo về máy.");
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCreateTask = async (text: string) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        title: `Triển khai chỉ đạo Bí thư Đảng ủy: ${idea.length > 60 ? idea.substring(0, 60) + '...' : idea}`,
        description: text,
        assignedOrganization: "Ủy ban nhân dân phường",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN'),
        status: 'PENDING',
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null
      });

      setSuccessMsg("Đã tạo nhiệm vụ đôn đốc UBND phường triển khai chỉ đạo thành công!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Task creation from draft failed:", err);
      setError("Không thể tự động tạo nhiệm vụ chỉ đạo.");
    }
  };

  // Feature 1 Handler: RACI Matrix
  const handleOpenExtractRaci = async (customText?: string) => {
    const textToProcess = customText || (result ? (selectedOptionTab === 'option1' ? result.option1 : result.option2) : (editableContent || idea));
    if (!textToProcess || !textToProcess.trim()) {
      setError("Vui lòng nhập nội dung chỉ đạo hoặc tạo dự thảo trước khi bóc tách Ma trận RACI.");
      return;
    }

    setShowRaciModal(true);
    setIsExtractingRaci(true);
    setSavedRaciSuccess(false);

    try {
      const res = await fetch('/api/extract-raci-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directiveText: textToProcess,
          documentType: selectedDocType,
          meetingContext: selectedMeetingContext
        })
      });

      if (!res.ok) throw new Error("Không thể bóc tách ma trận RACI.");
      const data: RaciExtractionResult = await res.json();
      setRaciResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Lỗi bóc tách ma trận RACI.");
    } finally {
      setIsExtractingRaci(false);
    }
  };

  const handleSaveAllRaciTasks = async () => {
    if (!raciResult || !raciResult.raciTasks || raciResult.raciTasks.length === 0) return;
    setIsSavingRaciTasks(true);
    try {
      for (const t of raciResult.raciTasks) {
        await addDoc(collection(db, 'tasks'), {
          title: t.title,
          description: t.description,
          assignedOrganization: t.responsible || "UBND Phường",
          suggestedResponsiblePerson: t.accountable || null,
          collaborators: [t.consulted, t.informed].filter(Boolean),
          dueDate: t.suggestedDueDate || null,
          priority: t.priority === 'KHẨN' ? 'CAO' : t.priority,
          status: 'PENDING',
          requiredOutput: t.expectedOutput,
          sourceDocumentTitle: 'Chỉ đạo Thường trực Đảng ủy',
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null
        });
      }
      setSavedRaciSuccess(true);
      setSuccessMsg(`Đã tự động lưu thành công ${raciResult.raciTasks.length} nhiệm vụ vào Bảng Theo Dõi Nhiệm Vụ!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Save RACI tasks error:", err);
      setError("Lỗi lưu nhiệm vụ vào hệ thống.");
    } finally {
      setIsSavingRaciTasks(false);
    }
  };

  // Feature 2 Handler: Meeting Briefing
  const handleOpenMeetingBriefing = async () => {
    setShowBriefingModal(true);
    if (!briefingResult) {
      await handleGenerateBriefing();
    }
  };

  const handleGenerateBriefing = async () => {
    setIsGeneratingBriefing(true);
    try {
      const res = await fetch('/api/generate-meeting-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingType: briefingMeetingType,
          specificFocus: briefingFocus,
          hotspotsContext: WARD_HOTSPOTS.map(h => `${h.title} (${h.location}): ${h.ideaTemplate}`).join('; '),
          pendingDirectivesContext: PREVIOUS_CONCLUSION_NOTICES.slice(0, 3).map(n => `${n.code} - ${n.title}`).join('; ')
        })
      });

      if (!res.ok) throw new Error("Không thể lập bản tin điều hành cuộc họp.");
      const data: MeetingBriefingResult = await res.json();
      setBriefingResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Lỗi tạo bản tin điều hành cuộc họp.");
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  // Feature 4 Handler: Deep Drive Brain Knowledge Engine
  const handleOpenDriveBrain = async () => {
    setShowDriveBrainModal(true);
    if (!driveBrainResult) {
      await handleRunDeepBrainLearn();
    }
  };

  const handleRunDeepBrainLearn = async () => {
    setIsLearningBrain(true);
    try {
      const res = await fetch('/api/deep-drive-sync-learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: TARGET_DRIVE_FOLDER_ID,
          sampleDocId: SAMPLE_CONCLUSION_DOC_ID
        })
      });

      if (!res.ok) throw new Error("Không thể thực hiện quy trình tự học sâu từ Google Drive.");
      const data: DeepDriveLearnResult = await res.json();
      setDriveBrainResult(data);
      setSuccessMsg("Bộ não AI Cấp ủy đã tự học và đồng bộ xong tri thức từ Google Drive!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Lỗi nạp tri thức từ Google Drive.");
    } finally {
      setIsLearningBrain(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 font-sans pb-12 px-4 md:px-6">
      
      {/* Header Banner - Executive & Leadership Focused with Google Studio Flowing Gradient Border */}
      <div className="google-studio-border google-studio-glow">
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 rounded-[calc(1.25rem-2px)] p-4 md:p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-blue-500/10">
          <div className="space-y-1.5 relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/25 text-amber-200 border border-amber-300/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 backdrop-blur-xs">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Trợ Lý AI Thường Trực Cấp Ủy
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-white border border-white/30 text-[10px] font-bold backdrop-blur-xs">
                Vai trò: Bí thư Đảng ủy Phường
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs">
                <FolderGit2 className="w-3 h-3" />
                Kho Thông Báo Kết Luận Drive: {TARGET_DRIVE_FOLDER_ID.substring(0, 8)}...
              </span>
            </div>
            <h1 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2 drop-shadow-xs">
              <span>Soạn Thảo Ý Kiến Kết Luận & Chỉ Đạo Của Bí Thư Đảng Ủy</span>
            </h1>
            <p className="text-xs text-blue-50 max-w-2xl font-medium">
              Văn phong đoạn văn lãnh đạo Cấp ủy: Đanh thép, khúc chiết, mang tính quyết sách • Lãnh đạo toàn diện UBND phường, Công an, Mặt trận - Đoàn thể và Chi bộ khu phố
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 relative z-10 flex-shrink-0">
            <button
              type="button"
              onClick={handleOpenMeetingBriefing}
              className="px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-900 font-black rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer border border-white/80 active:scale-95"
              title="Trợ lý tổng hợp điều hành & bộ câu hỏi chất vấn cho Bí thư Đảng ủy"
            >
              <Users className="w-3.5 h-3.5 text-blue-700" />
              <span>Trợ Lý Họp Cấp Ủy & Chất Vấn</span>
            </button>

            <button
              type="button"
              onClick={handleOpenDriveBrain}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer border border-white/30 backdrop-blur-xs"
              title="Bộ não AI tự học sâu từ kho tài liệu Google Drive"
            >
              <BrainCircuit className="w-3.5 h-3.5 text-sky-200" />
              <span>Bộ Não Tự Học Drive</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDocModal(true)}
              className="px-3 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer border border-amber-300"
              title="Xem trước mẫu thông báo kết luận chuẩn từ Google Docs"
            >
              <Eye className="w-3.5 h-3.5 text-slate-950" />
              <span>Mẫu Kết Luận Chuẩn</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 text-emerald-950 rounded-xl flex items-center gap-3 text-xs border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 text-red-950 rounded-xl flex items-center gap-3 text-xs border border-red-200 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Google Drive Knowledge Base Accordion Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div 
          onClick={() => setShowDriveArchive(!showDriveArchive)}
          className="p-3.5 md:p-4 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors flex items-center justify-between border-b border-slate-200"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                <span>KHO THÔNG BÁO KẾT LUẬN CỦA THƯỜNG TRỰC ĐẢNG ỦY (GOOGLE DRIVE)</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">
                  {PREVIOUS_CONCLUSION_NOTICES.length} văn bản mẫu
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                Các thông báo kết luận thực tế trước đây từ Google Drive Cấp ủy ({TARGET_DRIVE_FOLDER_ID}) dùng làm mẫu văn phong chuẩn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedNoticeReference && (
              <span className="hidden sm:inline-block px-2.5 py-1 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-lg border border-amber-200">
                Đang áp dụng: {selectedNoticeReference.code}
              </span>
            )}
            <button className="p-1 text-slate-500 hover:text-slate-900 rounded-lg">
              {showDriveArchive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showDriveArchive && (
          <div className="p-4 space-y-3 bg-white">
            {/* Search Bar for Notices */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm thông báo kết luận cũ..."
                  value={driveSearchTerm}
                  onChange={(e) => setDriveSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span>Nhấp <strong>"Nạp văn phong"</strong> để AI học tập cấu trúc đoạn văn lãnh đạo thực tiễn.</span>
              </div>
            </div>

            {/* Grid of notices */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {filteredNotices.map((notice) => {
                const isSelected = selectedNoticeReference?.id === notice.id;
                const isGoogleDocsSample = notice.id === 'tb-gdocs-sample';
                return (
                  <div
                    key={notice.id}
                    className={`p-3 rounded-xl border transition-all text-left space-y-2 flex flex-col justify-between ${
                      isGoogleDocsSample 
                        ? isSelected 
                          ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-400 shadow-md'
                          : 'bg-gradient-to-br from-amber-50/60 to-orange-50/50 border-amber-300 hover:border-amber-400 shadow-2xs'
                        : isSelected
                          ? 'bg-blue-50/70 border-blue-400 shadow-2xs'
                          : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                          isGoogleDocsSample 
                            ? 'bg-amber-500 text-slate-950 border-amber-600'
                            : 'text-blue-700 bg-white border-slate-200'
                        }`}>
                          {notice.code}
                        </span>
                        <span className={`text-[9px] font-bold ${
                          isGoogleDocsSample ? 'text-amber-800 font-black' : 'text-slate-500'
                        }`}>
                          {notice.category}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                        {notice.title}
                      </h4>

                      <p className="text-[11px] text-slate-600 line-clamp-2 italic font-normal leading-relaxed">
                        "{notice.summary}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSelectNoticeAsReference(notice)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                            isSelected
                              ? isGoogleDocsSample ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                              : isGoogleDocsSample ? 'bg-amber-100 hover:bg-amber-500 hover:text-slate-950 text-amber-950 border border-amber-300' : 'bg-white hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{isSelected ? 'Đang nạp văn phong' : 'Nạp văn phong'}</span>
                        </button>

                        {isGoogleDocsSample && (
                          <button
                            type="button"
                            onClick={() => setShowDocModal(true)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="Xem trước văn bản mẫu Google Docs"
                          >
                            <Eye className="w-3 h-3 text-amber-600" />
                            <span>Xem mẫu</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyNoticeTemplateToIdea(notice)}
                        className="px-2 py-1 bg-slate-200/80 hover:bg-slate-300 text-slate-800 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        title="Điền tóm tắt kết luận này vào ô nội dung chỉ đạo"
                      >
                        Áp dụng
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Studio Grid (5 cols input, 7 cols output) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Input Form (5/12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs space-y-4">
            
            {/* Step Header */}
            <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Nội Dung & Ý Kiến Chỉ Đạo Của Bí Thư</span>
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-black px-2 py-0.5 rounded-md border border-blue-200">
                Đoạn văn chính luận
              </span>
            </div>

            <form onSubmit={handleGenerate} className="space-y-3.5">
              
              {/* Document Form Selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Hình thức văn bản chỉ đạo:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {DOCUMENT_TYPES.map(dt => (
                    <button
                      key={dt.id}
                      type="button"
                      onClick={() => setSelectedDocType(dt.id)}
                      className={`p-2 rounded-xl text-left border transition-all text-xs cursor-pointer ${
                        selectedDocType === dt.id
                          ? 'bg-red-700 text-white font-black border-red-700 shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                      title={dt.desc}
                    >
                      <div className="text-[11px] leading-tight font-black">{dt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Meeting Context Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Bối cảnh cuộc họp / hội nghị cấp ủy:
                </label>
                <select
                  value={selectedMeetingContext}
                  onChange={(e) => setSelectedMeetingContext(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {MEETING_CONTEXTS.map(ctx => (
                    <option key={ctx.id} value={ctx.label}>
                      {ctx.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Themes by Ward Party Secretary */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Chủ đề trọng tâm địa bàn phường:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WARD_HOTSPOTS.map(spot => (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => handleSelectHotSpot(spot)}
                      className={`p-2 rounded-xl text-[11px] text-left border transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedHotSpot?.id === spot.id
                          ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="text-xs">{spot.icon}</span>
                      <span className="truncate leading-tight">{spot.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="directive-raw-idea" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Ý kiến chỉ đạo nguồn của Bí thư:
                  </label>
                  {idea && (
                    <button
                      type="button"
                      onClick={() => { setIdea(''); setSelectedHotSpot(null); setSelectedNoticeReference(null); }}
                      className="text-[10px] text-slate-400 hover:text-red-600 font-semibold cursor-pointer"
                    >
                      Xóa nội dung
                    </button>
                  )}
                </div>

                <textarea
                  id="directive-raw-idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Nhập nhanh ý kiến chỉ đạo, ví dụ: Yêu cầu UBND và Công an phường mở đợt cao điểm lập lại trật tự đô thị tuyến đường A, kiên quyết xử lý các trường hợp lấn chiếm lòng lề đường, phát huy vai trò giám sát của chi bộ khu phố..."
                  rows={4}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 leading-relaxed"
                  required
                />
              </div>

              {/* Reference indicator if loaded from Google Drive knowledge */}
              {selectedNoticeReference && (
                <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-bold">Mẫu tham chiếu Drive: </span>
                    <span className="italic">{selectedNoticeReference.code} ({selectedNoticeReference.category})</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedNoticeReference(null)}
                    className="text-[10px] text-slate-500 hover:text-red-600 font-bold flex-shrink-0 cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}

              {/* Quick Append Tags */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Chèn nhanh phân công:
                </span>
                <div className="flex flex-wrap gap-1">
                  {DIRECTIVE_QUICK_TAGS.map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAppendTag(tag.text)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-md text-[10px] font-semibold border border-slate-200 transition-colors cursor-pointer"
                    >
                      + {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGenerating || !idea.trim()}
                className="w-full py-3 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tham mưu các đoạn văn chỉ đạo theo phong cách Bí thư...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Soạn Thảo 02 Phương Án Đoạn Văn Chỉ Đạo Của Bí Thư</span>
                  </>
                )}
              </button>
            </form>

            {/* Resolution Check */}
            {matchingResolutions.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Căn cứ Nghị quyết cấp trên phù hợp:</span>
                </span>
                {matchingResolutions.map(res => (
                  <div key={res.id} className="p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[10px] space-y-0.5">
                    <div className="font-black text-emerald-900">{res.code}: {res.title}</div>
                    <div className="text-slate-600 italic">"{res.coreContent}"</div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Output & Studio View (7/12) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* View Mode Tabs */}
          <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1">
            <button
              onClick={() => setActiveRightTab('result')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'result'
                  ? 'bg-red-700 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Văn Bản Chỉ Đạo (Đoạn Văn)</span>
              {result && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
            </button>

            <button
              onClick={() => setActiveRightTab('versions')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'versions'
                  ? 'bg-red-700 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5 text-red-200" />
              <span>Phiên Bản ({draftVersions.length})</span>
            </button>

            <button
              onClick={() => setActiveRightTab('history')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'history'
                  ? 'bg-red-700 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Sổ Tay Chỉ Đạo ({historyItems.length})</span>
            </button>
          </div>

          {/* TAB 1: RESULT STUDIO (DIRECT PREVIEW & INLINE EDITING) */}
          {activeRightTab === 'result' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs min-h-[480px] flex flex-col justify-between space-y-4">
              {isGenerating ? (
                <div className="py-20 text-center space-y-3 my-auto">
                  <Loader2 className="w-10 h-10 animate-spin text-red-700 mx-auto" />
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Đang soạn thảo các đoạn văn chỉ đạo theo phong cách Bí thư Đảng ủy...
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Kết hợp các luận điểm chính trị - hành chính sâu sắc, phân công rõ người rõ việc cho UBND phường, Công an, Mặt trận và Chi bộ khu phố.
                  </p>
                </div>
              ) : !result ? (
                <div className="py-16 text-center text-slate-400 text-xs my-auto space-y-3">
                  <div className="w-12 h-12 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center shadow-2xs mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-xs text-slate-900 uppercase tracking-wide">Chưa có dự thảo ý kiến kết luận</p>
                    <p className="max-w-xs mx-auto text-slate-500 text-[11px] leading-relaxed">
                      Nhập ý kiến chỉ đạo ở cột bên trái (hoặc chọn mẫu từ Kho Thông Báo Kết Luận) rồi bấm <strong>"Soạn Thảo"</strong> để tạo văn bản hoàn chỉnh theo đoạn văn.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 flex-1 flex flex-col justify-between">
                  
                  {/* Two-Option Switcher Tabs */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setSelectedOptionTab('option1'); setIsEditing(false); }}
                      className={`p-2 rounded-lg text-left transition-all cursor-pointer ${
                        selectedOptionTab === 'option1'
                          ? 'bg-white text-red-950 shadow-2xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-red-700">Phương án 1 (Đoạn văn Quyết liệt)</span>
                        {selectedOptionTab === 'option1' && <Check className="w-3 h-3 text-red-700" />}
                      </div>
                      <div className="text-[11px] font-bold truncate mt-0.5">{result.styleDescription1}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setSelectedOptionTab('option2'); setIsEditing(false); }}
                      className={`p-2 rounded-lg text-left transition-all cursor-pointer ${
                        selectedOptionTab === 'option2'
                          ? 'bg-white text-blue-950 shadow-2xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-blue-700">Phương án 2 (Đoạn văn Dân vận khéo)</span>
                        {selectedOptionTab === 'option2' && <Check className="w-3 h-3 text-blue-700" />}
                      </div>
                      <div className="text-[11px] font-bold truncate mt-0.5">{result.styleDescription2}</div>
                    </button>
                  </div>

                  {/* Header info of selected draft */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md ${
                        selectedOptionTab === 'option1' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedOptionTab === 'option1' ? 'Quyết Liệt • Kỷ Cương Công Vụ' : 'Đồng Bộ • Dân Vận & Nêu Gương'}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800 truncate max-w-xs">
                        {selectedOptionTab === 'option1' ? result.styleDescription1 : result.styleDescription2}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={handleSaveInlineEdit}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Save className="w-3 h-3" />
                          <span>Lưu sửa</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa trực tiếp</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Draft Text Content Area */}
                  {isEditing ? (
                    <textarea
                      value={editableContent}
                      onChange={(e) => setEditableContent(e.target.value)}
                      rows={14}
                      className="w-full p-4 bg-slate-50 border border-red-400 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:outline-none leading-relaxed select-text"
                    />
                  ) : (
                    <div className="text-xs leading-relaxed text-slate-900 font-normal whitespace-pre-line bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 min-h-[300px] max-h-[420px] overflow-y-auto select-text shadow-inner space-y-3 font-serif">
                      {selectedOptionTab === 'option1' ? result.option1 : result.option2}
                    </div>
                  )}

                  {/* Action Buttons Bar */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã đồng bộ Sổ tay Chỉ đạo</span>
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard(selectedOptionTab === 'option1' ? result.option1 : result.option2)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                      >
                        {copiedText ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportDoc(selectedOptionTab === 'option1' ? result.option1 : result.option2)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                        title="Tải văn bản"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Xuất tệp</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePrint}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                        title="In văn bản"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>In</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenExtractRaci(selectedOptionTab === 'option1' ? result.option1 : result.option2)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer border border-emerald-500"
                        title="Tự động bóc tách Ma trận RACI (R-A-C-I) và phân công nhiệm vụ từ văn bản chỉ đạo"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>Bóc tách Ma Trận RACI</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCreateTask(selectedOptionTab === 'option1' ? result.option1 : result.option2)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Giao việc UBND</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 2: VERSIONS HISTORY */}
          {activeRightTab === 'versions' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Lịch Sử Các Bản Soạn Thảo Trong Phiên</span>
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md">
                  {draftVersions.length} phiên bản
                </span>
              </div>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {draftVersions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs space-y-1.5">
                    <History className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">Chưa có lịch sử phiên bản</p>
                  </div>
                ) : (
                  draftVersions.map((ver, idx) => (
                    <div 
                      key={ver.id}
                      className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl transition-all space-y-1.5 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-red-700 text-white text-[9px] font-black flex items-center justify-center">
                            {draftVersions.length - idx}
                          </span>
                          <span className="text-xs font-black text-slate-900">{ver.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                          {ver.timestamp}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 line-clamp-2 bg-white p-2 rounded-lg border border-slate-200/60 font-normal">
                        {ver.content}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.2 rounded">
                          {ver.style}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(ver)}
                          className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Khôi phục</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: NOTEBOOK / FIRESTORE HISTORY */}
          {activeRightTab === 'history' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Sổ Tay Chỉ Đạo Cấp Ủy</span>
                  </h3>
                </div>

                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm chỉ đạo..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* History Items List */}
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs space-y-1.5">
                    <AlertCircle className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">Chưa có dữ liệu nhật ký chỉ đạo</p>
                  </div>
                ) : (
                  filteredHistory.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => handleReuseHistory(item)}
                      className="group p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-xl cursor-pointer transition-all space-y-1.5 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-1.5 py-0.2 bg-white border border-slate-200 text-indigo-900 text-[9px] font-black rounded">
                          {item.style || 'Văn bản kết luận'}
                        </span>
                        
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHistory(item.id, e)}
                          disabled={isDeletingId === item.id}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title="Xóa"
                        >
                          {isDeletingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>

                      <p className="text-xs font-bold text-slate-900 line-clamp-1">
                        💡 {item.idea}
                      </p>
                      
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                        {item.selectedOptionText}
                      </p>

                      <div className="text-[10px] text-indigo-600 flex items-center justify-between font-bold pt-1 border-t border-slate-200/60">
                        <span className="flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          <span>Nhấp để tải lại mẫu này</span>
                        </span>
                        <span className="text-slate-400 text-[9px] font-mono">
                          {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString('vi-VN') : 'Gần đây'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Google Docs Benchmark Preview Modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Văn Bản Mẫu Chuẩn: Thông Báo Kết Luận Cấp Ủy</span>
                    <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold rounded">
                      Google Docs ID: {SAMPLE_CONCLUSION_DOC_ID.substring(0, 12)}...
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Mẫu văn bản chỉ đạo của Thường trực Đảng ủy phường định hình cấu trúc 4 mảng công tác
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={SAMPLE_CONCLUSION_DOC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mở trên Google Docs</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded Preview */}
            <div className="flex-1 bg-slate-100 p-2 md:p-4 overflow-hidden flex flex-col min-h-[420px]">
              <div className="bg-white rounded-xl shadow-inner border border-slate-200 flex-1 overflow-hidden relative">
                <iframe
                  src={SAMPLE_CONCLUSION_DOC_PREVIEW_URL}
                  className="w-full h-full border-0"
                  title="Google Docs Preview"
                  sandbox="allow-same-origin allow-scripts allow-popups"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="text-xs text-slate-600 font-medium">
                Link tài liệu: <span className="font-mono text-[11px] text-blue-700 select-all">{SAMPLE_CONCLUSION_DOC_URL}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sample = PREVIOUS_CONCLUSION_NOTICES.find(n => n.id === 'tb-gdocs-sample');
                    if (sample) {
                      handleSelectNoticeAsReference(sample);
                    }
                    setShowDocModal(false);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Nạp Văn Phong Chuẩn Này Cho AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const sample = PREVIOUS_CONCLUSION_NOTICES.find(n => n.id === 'tb-gdocs-sample');
                    if (sample) {
                      handleApplyNoticeTemplateToIdea(sample);
                    }
                    setShowDocModal(false);
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                >
                  Áp dụng cấu trúc vào ô soạn thảo
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RACI MATRIX EXTRACTION & AUTOMATED REMINDER NOTICE */}
      {/* ========================================================================= */}
      {showRaciModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white flex items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Ma Trận Phân Quyền RACI & Thông Báo Đôn Đốc Tự Động</span>
                    <span className="px-2 py-0.5 bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold rounded">
                      R-A-C-I Matrix
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Bóc tách tự động: R (Chủ trì), A (Phê duyệt/Chịu trách nhiệm), C (Phối hợp), I (Báo cáo nhận tin)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRaciModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-50 p-4 md:p-6 overflow-y-auto space-y-4">
              {isExtractingRaci ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  <p className="text-sm font-bold text-slate-800">AI đang quét toàn văn văn bản chỉ đạo & bóc tách cấu trúc RACI...</p>
                  <p className="text-xs text-slate-400">Phân luồng trách nhiệm UBND, Công an, Khối Vận và các Chi bộ khu phố</p>
                </div>
              ) : raciResult ? (
                <>
                  {/* Executive Summary */}
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs leading-relaxed space-y-1">
                    <div className="font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Tóm Lược Trọng Tâm Chỉ Đạo:</span>
                    </div>
                    <p className="font-medium">{raciResult.executiveSummary}</p>
                  </div>

                  {/* RACI Tasks Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <span>Danh Sách Nhiệm Vụ Đã Phân Vai RACI ({raciResult.raciTasks.length})</span>
                      </h4>
                      <span className="text-[11px] text-slate-500">Bấm "Lưu Hàng Loạt Vào Bảng Nhiệm Vụ" để quản lý tiến độ</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                              <th className="py-2.5 px-3">STT</th>
                              <th className="py-2.5 px-3">Nội dung nhiệm vụ</th>
                              <th className="py-2.5 px-3 text-emerald-800 bg-emerald-50/50">R (Chủ trì)</th>
                              <th className="py-2.5 px-3 text-blue-800 bg-blue-50/50">A (Chịu TN)</th>
                              <th className="py-2.5 px-3 text-purple-800">C (Phối hợp)</th>
                              <th className="py-2.5 px-3 text-amber-800">I (Nhận tin)</th>
                              <th className="py-2.5 px-3">Hạn chót</th>
                              <th className="py-2.5 px-3">Sản phẩm đầu ra</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {raciResult.raciTasks.map((task, idx) => (
                              <tr key={task.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-900 max-w-xs">
                                  <div>{task.title}</div>
                                  <div className="text-[10px] text-slate-500 font-normal mt-0.5">{task.description}</div>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-emerald-700 bg-emerald-50/30">{task.responsible}</td>
                                <td className="py-2.5 px-3 text-blue-700 font-semibold bg-blue-50/30">{task.accountable}</td>
                                <td className="py-2.5 px-3 text-purple-700">{task.consulted}</td>
                                <td className="py-2.5 px-3 text-amber-700">{task.informed}</td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-rose-700 font-bold whitespace-nowrap">{task.suggestedDueDate}</td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-[200px]">{task.expectedOutput}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Automated Reminder Notice Excerpt */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <span>Mẫu Thông Báo Đôn Đốc & Nhắc Nhở Tự Động (Kèm RACI)</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard(raciResult.automatedReminderNotice)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Sao chép văn bản đôn đốc</span>
                      </button>
                    </div>

                    <div className="p-4 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-serif leading-relaxed whitespace-pre-line shadow-inner max-h-56 overflow-y-auto">
                      {raciResult.automatedReminderNotice}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="text-xs text-slate-600 font-medium">
                {savedRaciSuccess ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Đã chuyển toàn bộ nhiệm vụ RACI vào hệ thống theo dõi!
                  </span>
                ) : (
                  <span>Tự động kết nối với Bảng Nhiệm Vụ & Phân công cán bộ</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenExtractRaci()}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Phân tích lại</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingRaciTasks || savedRaciSuccess || !raciResult}
                  onClick={handleSaveAllRaciTasks}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isSavingRaciTasks ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu nhiệm vụ...</span>
                    </>
                  ) : savedRaciSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Đã Lưu Hoàn Tất</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Lưu Hàng Loạt Vào Bảng Nhiệm Vụ</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EXECUTIVE MEETING BRIEFING & SHARP INTERROGATION QUESTIONS */}
      {/* ========================================================================= */}
      {showBriefingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center font-black">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Trợ Lý Điều Hành Cuộc Họp & Bộ Câu Hỏi Chất Vấn Sắc Bén</span>
                    <span className="px-2 py-0.5 bg-blue-400/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold rounded">
                      Executive Briefing
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Bản tin điều hành, cảnh báo điểm nóng và các câu hỏi sắc sảo dành riêng cho Bí thư Đảng ủy
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBriefingModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Settings Bar */}
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
                <span className="font-bold text-slate-700 whitespace-nowrap">Cuộc họp:</span>
                <input
                  type="text"
                  value={briefingMeetingType}
                  onChange={(e) => setBriefingMeetingType(e.target.value)}
                  className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-1 min-w-[280px]">
                <span className="font-bold text-slate-700 whitespace-nowrap">Trọng tâm:</span>
                <input
                  type="text"
                  value={briefingFocus}
                  onChange={(e) => setBriefingFocus(e.target.value)}
                  className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateBriefing}
                disabled={isGeneratingBriefing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isGeneratingBriefing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                <span>Tổng Hợp Lại</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-50 p-4 md:p-6 overflow-y-auto space-y-4">
              {isGeneratingBriefing ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm font-bold text-slate-800">AI đang tổng hợp dữ liệu bản đồ số, điểm nóng và tiến độ chỉ đạo...</p>
                  <p className="text-xs text-slate-400">Đang tạo kịch bản điều hành và bộ câu hỏi chất vấn trọng tâm cho Bí thư</p>
                </div>
              ) : briefingResult ? (
                <>
                  {/* Title & Overview */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2">
                    <h4 className="text-sm font-black text-blue-950 uppercase">{briefingResult.briefingTitle}</h4>
                    <div className="space-y-1">
                      {briefingResult.situationOverview.map((point, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></span>
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sharp Interrogation Questions (Key Highlight) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Bộ Câu Hỏi Chất Vấn Sắc Bén Dành Cho Bí Thư Đảng Ủy</span>
                      </h4>
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Chất vấn trực tiếp tại cuộc họp
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {briefingResult.sharpInterrogationQuestions.map((q, idx) => (
                        <div key={idx} className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-black text-rose-900 uppercase">Đối tượng: {q.targetAudience}</span>
                            <span className="font-mono text-[10px] text-slate-400">Câu #{idx + 1}</span>
                          </div>
                          <p className="text-xs font-bold text-slate-900 font-serif leading-relaxed italic">
                            "{q.question}"
                          </p>
                          <div className="text-[10px] text-slate-600 bg-white/70 p-2 rounded-lg border border-rose-100">
                            <span className="font-bold text-rose-800">Mục đích: </span>{q.purpose}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hotspot Alerts & Pending Directives Review */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2.5 shadow-2xs">
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Cảnh Báo Điểm Nóng Địa Bàn</span>
                      </h4>
                      <div className="space-y-2">
                        {briefingResult.hotspotAlerts.map((h, idx) => (
                          <div key={idx} className="p-2.5 bg-white border border-amber-200 rounded-lg text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold text-slate-900">
                              <span>{h.location}</span>
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] rounded font-mono">{h.riskLevel}</span>
                            </div>
                            <p className="text-[11px] text-slate-600">{h.issue}</p>
                            <p className="text-[11px] text-blue-900 font-semibold italic">Gợi ý: {h.recommendationForSecretary}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                        <span>Kiểm Điểm Nhiệm Vụ Đang Tồn Đọng</span>
                      </h4>
                      <div className="space-y-2">
                        {briefingResult.pendingDirectivesReview.map((p, idx) => (
                          <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                            <div className="font-bold text-slate-900">{p.directiveName}</div>
                            <div className="text-[11px] text-slate-500">Đơn vị: {p.assignedUnit} • Tiến độ: <span className="font-semibold text-rose-700">{p.progressStatus}</span></div>
                            <div className="text-[11px] text-slate-700"><span className="font-bold text-slate-900">Điểm nghẽn: </span>{p.bottleneck}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Draft Conclusion Points */}
                  <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>Dự Thảo Kết Luận Sẵn Sàng Ban Hành Cuối Cuộc Họp</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const conclusionText = briefingResult.draftConclusionPoints.join('\n\n');
                          setIdea(conclusionText);
                          setShowBriefingModal(false);
                          setSuccessMsg("Đã chuyển các điểm kết luận vào ô Soạn thảo chỉ đạo!");
                          setTimeout(() => setSuccessMsg(null), 3000);
                        }}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-blue-300"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Đưa vào Soạn Thảo Chỉ Đạo</span>
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {briefingResult.draftConclusionPoints.map((point, idx) => (
                        <div key={idx} className="p-2.5 bg-white border border-blue-100 rounded-lg text-xs text-slate-900 font-serif leading-relaxed">
                          <span className="font-bold text-blue-900 mr-1.5">{idx + 1}.</span>
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBriefingModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DEEP DRIVE BRAIN KNOWLEDGE DISTILLATION ENGINE */}
      {/* ========================================================================= */}
      {showDriveBrainModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Bộ Não Tri Thức AI Cấp Ủy (Google Drive Distillation)</span>
                    <span className="px-2 py-0.5 bg-purple-400/20 text-purple-300 border border-purple-400/30 text-[10px] font-bold rounded">
                      Adaptive Brain v2.5
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Hệ thống tự học sâu mẫu văn bản, từ ngữ lãnh đạo đanh thép và tiền lệ chỉ đạo Cấp ủy
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDriveBrainModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-50 p-4 md:p-6 overflow-y-auto space-y-4">
              {isLearningBrain ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  <p className="text-sm font-bold text-slate-800">AI đang quét kho tài liệu Google Drive & cập nhật Ngân hàng Từ ngữ Lãnh đạo...</p>
                  <p className="text-xs text-slate-400">Đang đồng hóa mẫu thông báo kết luận ({SAMPLE_CONCLUSION_DOC_ID.substring(0, 10)}...)</p>
                </div>
              ) : driveBrainResult ? (
                <>
                  {/* Readiness Index & Status Banner */}
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black text-purple-900 uppercase tracking-wider">Chỉ Số Sẵn Sàng Của Hệ Thống AI</div>
                      <div className="text-2xl font-black text-purple-950 mt-0.5">{driveBrainResult.systemReadinessIndex}% Hoàn Hảo</div>
                      <p className="text-[11px] text-slate-600 mt-1">Cập nhật lúc: {driveBrainResult.learnedAt} • Trạng thái: {driveBrainResult.syncStatus}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunDeepBrainLearn}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Đồng Bộ & Tự Học Lại</span>
                    </button>
                  </div>

                  {/* Vocabulary Bank */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span>Ngân Hàng Từ Ngữ Quyết Sách Đã Tự Học</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {driveBrainResult.executiveVocabularyBank.map((v, idx) => (
                        <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                          <div className="text-[10px] font-black text-purple-900 uppercase border-b border-slate-100 pb-1">
                            {v.category}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {v.phrases.map((phrase, pIdx) => (
                              <span key={pIdx} className="px-2 py-0.5 bg-purple-50 text-purple-800 text-[11px] font-semibold rounded-md border border-purple-100">
                                {phrase}
                              </span>
                            ))}
                          </div>
                          <div className="text-[10px] text-slate-500 italic mt-1">{v.usageContext}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Learned Precedents */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Tiền Lệ Chỉ Đạo & Bài Học Kinh Nghiệm Cấp Ủy</span>
                    </h4>

                    <div className="space-y-2">
                      {driveBrainResult.learnedPrecedents.map((prec, idx) => (
                        <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                            <span>{prec.resolutionCode} - {prec.coreSubject}</span>
                          </div>
                          <p className="text-xs text-slate-700"><span className="font-bold text-slate-900">Bài học: </span>{prec.keyLessonLearned}</p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {prec.applicableScenarios.map((sc, scIdx) => (
                              <span key={scIdx} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded">
                                {sc}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Executive Style Rules */}
                  <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl space-y-2">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Quy Tắc Văn Phong Bắt Buộc Của Cấp Ủy Phường:</h4>
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                      {driveBrainResult.executiveStyleRules.map((rule, idx) => (
                        <li key={idx}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDriveBrainModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
