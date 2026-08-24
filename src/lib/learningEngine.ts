import { db } from './firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';

export interface LearningRule {
  id?: string;
  keywordTrigger: string;       // E.g. "Trật tự đô thị", "Lấn chiếm vỉa hè", "Đấu thầu"
  suggestedLeadDept: string;    // E.g. "Đội Trật tự Đô thị & Công an Phường"
  suggestedAction: string;      // E.g. "Giao Đội Đô thị phối hợp Công an ra quân kiểm tra"
  suggestedCoordinating?: string[];
  suggestedDraftType?: string;
  sourceDocNumber?: string;
  learnedAt: string;            // ISO timestamp or DD/MM/YYYY
  confidence: number;           // E.g. 95 (percentage)
  useCount: number;             // How many times this rule matched
  isActive: boolean;
  notes?: string;
  reviewedBy?: string;
  scenarioId?: string;
  rating?: number;
}

export interface ScenarioOption {
  id: string;
  title: string;
  leadDept: string;
  action: string;
  isRecommendedByPolicy: boolean;
  explanation: string;
}

export interface ScenarioItem {
  id: string;
  title: string;
  category: 'THAM_QUYEN_BTV_UBND' | 'DON_THU_KHIẾU_NẠI' | 'HOA_TOC_CHI_DAO' | 'TO_CHUC_DANG_VIEN' | 'TRAT_TU_DO_THI' | 'TAI_CHINH_NGAN_SACH';
  categoryLabel: string;
  urgency: 'HO_TOC' | 'KHAN' | 'THUONG';
  urgencyLabel: string;
  background: string;
  keyQuestion: string;
  keywordTriggers: string;
  defaultAiAdvice: {
    authority: string; // E.g. "Ban Thường vụ Đảng ủy cho chủ trương, UBND phường tổ chức thực hiện"
    suggestedRouting: string;
    suggestedDirective: string;
    legalBasis: string[];
  };
  options: ScenarioOption[];
}

export interface ContributorProfile {
  name: string;
  title: string;
  level: number; // 1 to 5
  levelName: string;
  totalReviews: number;
  totalPoints: number;
  accuracyRating: number;
  badges: string[];
}

export interface ScenarioReviewSubmission {
  id?: string;
  scenarioId: string;
  scenarioTitle: string;
  rating: number; // 1 to 5 stars
  selectedOptionId: string;
  customDirective: string;
  customRouting: string;
  keywordTrigger: string;
  reviewerName: string;
  submittedAt: string;
  pointsEarned: number;
}

// Built-in Realistic Party Committee Office Daily Scenarios
export const DAILY_SCENARIOS_BANK: ScenarioItem[] = [
  {
    id: 'sc-1',
    title: 'Chủ trương chuyển đổi khu đất công trình công cộng thành bãi đỗ xe thông minh',
    category: 'THAM_QUYEN_BTV_UBND',
    categoryLabel: 'Phân định Thẩm quyền BTV Đảng ủy vs UBND',
    urgency: 'KHAN',
    urgencyLabel: 'Khẩn',
    background: 'UBND phường tiếp nhận đề xuất từ doanh nghiệp xã hội hóa đầu tư bãi đỗ xe thông minh trên khu đất công rộng 1.200m2 cạnh chợ trung tâm. Đề xuất xin miễn giảm tiền thuê đất và cam kết hoàn thành trước Tết.',
    keyQuestion: 'Văn phòng Đảng ủy cần tham mưu phân luồng thẩm quyền và quy trình xử lý như thế nào theo Quy chế làm việc?',
    keywordTriggers: 'đất công, bãi đỗ xe, xã hội hóa, quy hoạch đô thị, chuyển đổi mục đích',
    defaultAiAdvice: {
      authority: 'Thuộc thẩm quyền Ban Thường vụ Đảng ủy cho chủ trương trước khi UBND phường trình UBND Thành phố/Quận phê duyệt.',
      suggestedRouting: 'Văn phòng Đảng ủy tham mưu đưa vào Chương trình họp Ban Thường vụ định kỳ; yêu cầu UBND phường chuẩn bị Báo cáo Tờ trình đánh giá tác động quy hoạch và an ninh trật tự.',
      suggestedDirective: 'Giao UBND phường hoàn thiện hồ sơ báo cáo Ban Thường vụ Đảng ủy trong phiên họp tới; tuyệt đối không tự ý thỏa thuận khi chưa có Nghị quyết/Kết luận của Cấp ủy.',
      legalBasis: ['Quy chế làm việc Ban Chấp hành Đảng bộ & Ban Thường vụ Đảng ủy', 'Luật Đất đai', 'Quy định 66-QĐ/TW']
    },
    options: [
      {
        id: 'opt-1a',
        title: 'Trình Ban Thường vụ Đảng ủy cho chủ trương (Chuẩn quy chế)',
        leadDept: 'Văn phòng Đảng ủy & UBND Phường',
        action: 'Tham mưu đưa vào lịch họp BTV Đảng ủy; yêu cầu UBND hoàn thiện tờ trình đánh giá tác động giao thông, an ninh.',
        isRecommendedByPolicy: true,
        explanation: 'Việc sử dụng đất công và dự án hạ tầng lớn bắt buộc phải có chủ trương thống nhất của Ban Thường vụ Đảng ủy.'
      },
      {
        id: 'opt-1b',
        title: 'Giao UBND phường tự quyết định phê duyệt cấp phép thí điểm',
        leadDept: 'UBND Phường',
        action: 'Chuyển UBND phường chủ động ký kết thỏa thuận hợp tác với doanh nghiệp để kịp tiến độ Tết.',
        isRecommendedByPolicy: false,
        explanation: 'Sai thẩm quyền quy chế! UBND cấp xã/phường không được tự ý quyết định dự án hạ tầng trên đất công khi chưa thông qua BTV.'
      },
      {
        id: 'opt-1c',
        title: 'Chuyển toàn bộ hồ sơ lên Sở Quy hoạch Kiến trúc mà không qua Cấp ủy',
        leadDept: 'Bộ phận Địa chính - Xây dựng',
        action: 'Chuyển hồ sơ thẳng lên cơ quan cấp trên, bỏ qua bước báo cáo Ban Thường vụ Đảng ủy.',
        isRecommendedByPolicy: false,
        explanation: 'Bỏ qua vai trò lãnh đạo toàn diện của Đảng bộ địa phương đối với các công trình trọng điểm trên địa bàn.'
      }
    ]
  },
  {
    id: 'sc-2',
    title: 'Đơn thư khiếu nại tập thể đông người về đền bù giải phóng mặt bằng đường Vành Đai',
    category: 'DON_THU_KHIẾU_NẠI',
    categoryLabel: 'Đơn thư Khiếu nại & Tiếp Dân',
    urgency: 'HO_TOC',
    urgencyLabel: 'Hỏa tốc',
    background: 'Sáng nay có khoảng 25 hộ dân tập trung tại trụ sở UBND và Văn phòng Đảng ủy mang theo băng rôn phản ánh đơn giá đền bù cây trồng và vật kiến trúc dự án mở rộng đường chưa thỏa đáng, yêu cầu Bí thư Đảng ủy đối thoại trực tiếp.',
    keyQuestion: 'Văn phòng Cấp ủy cần tham mưu ngay những hành động cấp bách nào để ổn định an ninh và xử lý đúng luật?',
    keywordTriggers: 'khiếu nại đông người, đền bù giải tỏa, đối thoại nhân dân, an ninh trật tự',
    defaultAiAdvice: {
      authority: 'Thường trực Đảng ủy chỉ đạo; Chủ tịch UBND phường chủ trì tiếp công dân theo thẩm quyền; Công an phường đảm bảo an ninh trật tự.',
      suggestedRouting: 'Kích hoạt Tổ công tác tiếp công dân đột xuất: Bí thư Đảng ủy phân công Phó Bí thư/Chủ tịch UBND tiếp, ghi nhận biên bản; Công an phường phân luồng giao thông tránh tụ tập kéo dài.',
      suggestedDirective: 'Yêu cầu Chủ tịch UBND phường trực tiếp chủ trì buổi làm việc với đại diện các hộ dân; ghi nhận đầy đủ kiến nghị; báo cáo Thường trực Đảng ủy kết quả trước 16h00 cùng ngày.',
      legalBasis: ['Luật Tiếp công dân', 'Quy định 11-QĐ/TW của Bộ Chính trị về trách nhiệm người đứng đầu cấp ủy trong tiếp dân', 'Nghị định 30/2020/NĐ-CP']
    },
    options: [
      {
        id: 'opt-2a',
        title: 'Bí thư Đảng ủy chỉ đạo UBND tiếp dân theo luật + Công an giữ vững trật tự (Chuẩn mực)',
        leadDept: 'UBND Phường & Công an Phường',
        action: 'Mời đại diện 3-5 người vào phòng tiếp dân; đối thoại mềm mỏng, giải thích chính sách; lập biên bản và có mốc hẹn trả lời bằng văn bản.',
        isRecommendedByPolicy: true,
        explanation: 'Đúng Quy định 11-QĐ/TW: Người đứng đầu cấp ủy nắm tình hình, chỉ đạo chính quyền giải quyết thấu tình đạt lý, ngăn ngừa điểm nóng.'
      },
      {
        id: 'opt-2b',
        title: 'Yêu cầu lực lượng công an cưỡng chế giải tán ngay lập tức',
        leadDept: 'Công an Phường',
        action: 'Sử dụng biện pháp hành chính giải tán người dân khỏi cổng trụ sở.',
        isRecommendedByPolicy: false,
        explanation: 'Sai nguyên tắc vận động quần chúng, dễ làm bùng phát xung đột và kích động khiếu kiện vượt cấp.'
      },
      {
        id: 'opt-2c',
        title: 'Từ chối tiếp vì không đăng ký lịch trước, yêu cầu gửi đơn qua bưu điện',
        leadDept: 'Bộ phận Tiếp nhận & Trả kết quả',
        action: 'Đóng cửa phòng tiếp dân và yêu cầu công dân giải tán nộp đơn qua dịch vụ công.',
        isRecommendedByPolicy: false,
        explanation: 'Vi phạm Luật Tiếp công dân đối với vụ việc đông người có nguy cơ phức tạp về an ninh trật tự.'
      }
    ]
  },
  {
    id: 'sc-3',
    title: 'Văn bản Hỏa tốc của Thành ủy yêu cầu rà soát kỷ luật Đảng viên và hoàn thành trước 15h00',
    category: 'HOA_TOC_CHI_DAO',
    categoryLabel: 'Văn bản Hỏa tốc & Đôn đốc Tiến độ',
    urgency: 'HO_TOC',
    urgencyLabel: 'Hỏa tốc',
    background: '10h30 nhận được Công văn Hỏa tốc từ Ủy ban Kiểm tra Thành ủy yêu cầu rà soát, báo cáo gấp danh sách Đảng viên vi phạm quy định nồng độ cồn và trật tự đô thị trong Quý III để phục vụ công tác nhân sự.',
    keyQuestion: 'Trợ lý Văn phòng cần tham mưu phân công đơn vị nào và quy trình lập báo cáo hỏa tốc ra sao?',
    keywordTriggers: 'ủy ban kiểm tra, nồng độ cồn, kỷ luật đảng viên, hỏa tốc, rà soát nhân sự',
    defaultAiAdvice: {
      authority: 'Ủy ban Kiểm tra Đảng ủy phối hợp Công an Phường và Chi bộ trực thuộc; Thường trực Đảng ủy duyệt báo cáo gửi Thành ủy.',
      suggestedRouting: 'Chuyển ngay UBKT Đảng ủy chủ trì, Công an phường đối chiếu biên bản vi phạm giao thông; Văn phòng tổng hợp dự thảo báo cáo trình Thường trực ký trước 14h30.',
      suggestedDirective: 'Giao UBKT Đảng ủy chủ trì phối hợp Công an rà soát chính xác 100% danh sách; khẩn trương hoàn thành dự thảo Báo cáo trình Bí thư Đảng ủy duyệt ký trước 14h30.',
      legalBasis: ['Quy định 69-QĐ/TW về kỷ luật tổ chức đảng và đảng viên vi phạm', 'Quy chế làm việc UBKT Đảng ủy']
    },
    options: [
      {
        id: 'opt-3a',
        title: 'Phân luồng UBKT Đảng ủy phối hợp Công an rà soát cấp tốc (Chuẩn xác)',
        leadDept: 'Ủy ban Kiểm tra Đảng ủy & Công an Phường',
        action: 'Kích hoạt quy trình văn bản Hỏa tốc, chốt danh sách lúc 13h30, hoàn tất dự thảo báo cáo trình Thường trực lúc 14h30.',
        isRecommendedByPolicy: true,
        explanation: 'Đúng thẩm quyền kiểm tra Đảng và đảm bảo thời hạn theo quy định văn bản Hỏa tốc.'
      },
      {
        id: 'opt-3b',
        title: 'Giao Bộ phận Văn phòng Một cửa tự liên hệ các Chi bộ hỏi thông tin',
        leadDept: 'Văn phòng HĐND-UBND',
        action: 'Để chuyên viên hành chính gọi điện hỏi từng Bí thư Chi bộ.',
        isRecommendedByPolicy: false,
        explanation: 'Không đúng kênh bảo mật kỷ luật Đảng và không kịp mốc thời gian 15h00.'
      }
    ]
  },
  {
    id: 'sc-4',
    title: 'Đơn thư nặc danh tố cáo phẩm chất của cán bộ nguồn trước kỳ Đại hội Chi bộ',
    category: 'TO_CHUC_DANG_VIEN',
    categoryLabel: 'Công tác Cán bộ & Bảo vệ Chính trị Nội bộ',
    urgency: 'KHAN',
    urgencyLabel: 'Khẩn',
    background: 'Văn phòng Đảng ủy nhận được đơn không ghi tên người gửi, tố cáo một đồng chí Phó Bí thư Chi bộ khu phố có hành vi vi phạm đạo đức lối sống ngay trước thềm đại hội nhiệm kỳ mới.',
    keyQuestion: 'Theo Điều lệ Đảng và quy định của Ban Bí thư, đơn thư nặc danh được xử lý như thế nào?',
    keywordTriggers: 'đơn thư nặc danh, đại hội chi bộ, nhân sự cán bộ, ủy ban kiểm tra',
    defaultAiAdvice: {
      authority: 'Thường trực Đảng ủy xem xét; UBKT Đảng ủy và Ban Tổ chức Đảng ủy thẩm tra theo nguyên tắc xử lý đơn nặc danh.',
      suggestedRouting: 'Báo cáo Bí thư Đảng ủy: Đơn nặc danh không xem xét theo thể thức thụ lý khiếu nại thông thường, nhưng nếu có tài liệu bằng chứng cụ thể thì UBKT Đảng ủy tiến hành nắm tình hình nội bộ.',
      suggestedDirective: 'Giao UBKT Đảng ủy nắm tình hình, phối hợp Chi ủy thẩm tra xác minh bí mật; tránh để kẻ xấu lợi dụng kích động làm phức tạp tình hình nhân sự đại hội.',
      legalBasis: ['Quy định 22-QĐ/TW về công tác kiểm tra, giám sát và kỷ luật của Đảng', 'Quy định số 37-QĐ/TW về những điều đảng viên không được làm']
    },
    options: [
      {
        id: 'opt-4a',
        title: 'Báo cáo Bí thư Đảng ủy + UBKT Đảng ủy thẩm tra xác minh khách quan (Chuẩn Đảng)',
        leadDept: 'Ủy ban Kiểm tra Đảng ủy & Ban Tổ chức Đảng ủy',
        action: 'Không thụ lý chính thức nhưng nắm tình hình, bảo vệ uy tín cán bộ nếu không có căn cứ, xử lý nghiêm nếu có vi phạm rõ ràng.',
        isRecommendedByPolicy: true,
        explanation: 'Bảo đảm quy định bảo vệ cán bộ trước đại hội, chống đơn thư bịa đặt nhưng không bỏ lọt vi phạm.'
      },
      {
        id: 'opt-4b',
        title: 'Tạm đình chỉ nhân sự đại hội ngay lập tức khi nhận được đơn',
        leadDept: 'Ban Thường vụ Đảng ủy',
        action: 'Loại đồng chí bị tố cáo ra khỏi danh sách quy hoạch ngay mà không cần xác minh.',
        isRecommendedByPolicy: false,
        explanation: 'Vi phạm nghiêm trọng nguyên tắc bảo vệ chính trị nội bộ và Điều lệ Đảng.'
      }
    ]
  },
  {
    id: 'sc-5',
    title: 'Xử lý điểm nóng trật tự đô thị & PCCC tại khu nhà trọ công nhân tự phát',
    category: 'TRAT_TU_DO_THI',
    categoryLabel: 'Trật tự Đô thị & An toàn PCCC',
    urgency: 'KHAN',
    urgencyLabel: 'Khẩn',
    background: 'Báo chí và phản ánh từ Tổ nhân dân tự quản cho biết khu nhà trọ hơn 80 phòng ngăn tạm bợ bằng ván ép, không có lối thoát nạn thứ 2, thường xuyên lấn chiếm hẻm làm nơi để xe, nguy cơ cháy nổ cao.',
    keyQuestion: 'Văn phòng Cấp ủy tham mưu văn bản chỉ đạo nào để giải quyết dứt điểm?',
    keywordTriggers: 'nhà trọ công nhân, pccc, lối thoát nạn, kiểm tra liên ngành, trật tự đô thị',
    defaultAiAdvice: {
      authority: 'Đảng ủy ra Chỉ thị / Thông báo Kết luận chỉ đạo UBND phường thành lập đoàn kiểm tra liên ngành.',
      suggestedRouting: 'Giao UBND phường chủ trì, Công an phường (lực lượng PCCC) và Đội Đô thị kiểm tra 100% phòng trọ; yêu cầu chủ nhà trọ mở lối thoát nạn trong 07 ngày.',
      suggestedDirective: 'Yêu cầu UBND phường kiểm tra ngay trong 48h; kiên quyết tạm đình chỉ hoạt động nếu không đảm bảo điều kiện PCCC tối thiểu; báo cáo Thường trực Đảng ủy vào thứ Sáu.',
      legalBasis: ['Luật Phòng cháy và Chữa cháy', 'Chỉ thị số 01/CT-TTg của Thủ tướng Chính phủ về tăng cường công tác PCCC']
    },
    options: [
      {
        id: 'opt-5a',
        title: 'UBND thành lập đoàn liên ngành kiểm tra, cưỡng chế mở lối thoát nạn (Chuẩn)',
        leadDept: 'UBND Phường & Công an Phường',
        action: 'Kiểm tra liên ngành, lập biên bản, cho hạn 7 ngày khắc phục; kiên quyết dừng hoạt động nếu không tuân thủ.',
        isRecommendedByPolicy: true,
        explanation: 'Đúng tinh thần Chỉ thị của Thủ tướng và chỉ đạo của Tỉnh ủy/Thành ủy về an toàn tính mạng người dân.'
      },
      {
        id: 'opt-5b',
        title: 'Chỉ nhắc nhở miệng trên loa phát thanh khu phố',
        leadDept: 'Bộ phận Văn hóa - Xã hội',
        action: 'Tuyên truyền chung chung qua loa truyền thanh mà không kiểm tra thực tế.',
        isRecommendedByPolicy: false,
        explanation: 'Không có hiệu lực răn đe, nếu xảy ra cháy nổ người đứng đầu cấp ủy và chính quyền sẽ bị xử lý trách nhiệm nặng.'
      }
    ]
  }
];

// Initial seed default rules learned from expert adjustments
export const DEFAULT_LEARNED_RULES: LearningRule[] = [
  {
    id: 'rule-1',
    keywordTrigger: 'vỉa hè, họp chợ, trật tự đô thị, lòng đường',
    suggestedLeadDept: 'Đội Trật tự Đô thị & Công an Phường',
    suggestedAction: 'Giao Đội Trật tự Đô thị phối hợp Công an ra quân kiểm tra, xử lý dứt điểm và báo cáo Thường trực UBND',
    suggestedCoordinating: ['Công an Phường', 'Mặt trận Tổ quốc'],
    suggestedDraftType: 'Thông báo Kết luận',
    learnedAt: '18/08/2026',
    confidence: 98,
    useCount: 14,
    isActive: true,
    notes: 'Học từ sự điều chỉnh của Lãnh đạo VP đối với các văn bản trật tự đô thị Chợ Thủ Dầu Một'
  },
  {
    id: 'rule-2',
    keywordTrigger: 'pccc, phòng cháy, nhà trọ, chung cư cũ',
    suggestedLeadDept: 'Công an Phường Thủ Dầu Một',
    suggestedAction: 'Yêu cầu Công an Phường chủ trì phối hợp Cảnh sát PCCC kiểm tra toàn diện, mở lối thoát nạn thứ 2',
    suggestedCoordinating: ['Bộ phận Đô thị', 'Đội Bảo vệ An ninh'],
    suggestedDraftType: 'Chỉ thị khẩn',
    learnedAt: '15/08/2026',
    confidence: 96,
    useCount: 9,
    isActive: true,
    notes: 'Học từ ý kiến chỉ đạo đôn đốc PCCC khu nhà trọ công nhân Hiệp Thành'
  },
  {
    id: 'rule-3',
    keywordTrigger: 'ngân sách, quyết toán, dự toán, kinh phí',
    suggestedLeadDept: 'Bộ phận Tài chính - Kế toán',
    suggestedAction: 'Giao Bộ phận Tài chính - Kế toán thẩm định nguồn kinh phí, tham mưu dự thảo Tờ trình gửi Thường trực HĐND',
    suggestedCoordinating: ['Văn phòng HĐND-UBND'],
    suggestedDraftType: 'Tờ trình',
    learnedAt: '12/08/2026',
    confidence: 95,
    useCount: 22,
    isActive: true,
    notes: 'Quy tắc phân luồng tài chính công chuẩn hóa'
  },
  {
    id: 'rule-4',
    keywordTrigger: 'chuyển đổi số, dịch vụ công, qr code, wifi',
    suggestedLeadDept: 'Tổ Chuyển đổi số Cộng đồng Phường',
    suggestedAction: 'Giao Tổ Chuyển đổi số Cộng đồng chủ trì triển khai trang bị hạ tầng số và hướng dẫn nhân dân',
    suggestedCoordinating: ['Đoàn Thanh niên', 'Văn phòng Một Cửa'],
    suggestedDraftType: 'Kế hoạch triển khai',
    learnedAt: '10/08/2026',
    confidence: 94,
    useCount: 11,
    isActive: true,
    notes: 'Học từ đề án chuyển đổi số phường Phú Cường - Thủ Dầu Một'
  }
];

// Memory cache for active learned rules
let cachedRules: LearningRule[] = [];

export async function getActiveLearningRules(): Promise<LearningRule[]> {
  try {
    const snap = await getDocs(query(collection(db, 'learning_rules'), limit(50)));
    if (!snap.empty) {
      const dbRules = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningRule));
      cachedRules = dbRules;
      return dbRules;
    }
  } catch (err) {
    console.warn("Using local learned rules cache due to Firestore read state:", err);
  }

  if (cachedRules.length === 0) {
    cachedRules = DEFAULT_LEARNED_RULES;
  }
  return cachedRules;
}

export async function saveLearnedAdjustmentRule(newRule: Omit<LearningRule, 'id'>): Promise<LearningRule> {
  const ruleToSave: LearningRule = {
    ...newRule,
    learnedAt: new Date().toLocaleDateString('vi-VN'),
    useCount: 1,
    confidence: 95,
    isActive: true
  };

  try {
    const docRef = await addDoc(collection(db, 'learning_rules'), ruleToSave);
    const saved = { ...ruleToSave, id: docRef.id };
    cachedRules = [saved, ...cachedRules];
    return saved;
  } catch (err) {
    console.error("Error saving rule to Firestore, storing in memory:", err);
    const mockId = `rule-${Date.now()}`;
    const saved = { ...ruleToSave, id: mockId };
    cachedRules = [saved, ...cachedRules];
    return saved;
  }
}

export function matchTextAgainstLearnedRules(text: string, rules: LearningRule[]): LearningRule | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  for (const rule of rules) {
    if (!rule.isActive) continue;
    const triggers = rule.keywordTrigger.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const isMatched = triggers.some(trigger => lowerText.includes(trigger));
    if (isMatched) {
      return rule;
    }
  }

  return null;
}

const LOCAL_STORAGE_CONTRIBUTOR_KEY = 'ai_party_contributor_profile';
const LOCAL_STORAGE_REVIEWS_KEY = 'ai_party_scenario_reviews';

export function getContributorProfile(): ContributorProfile {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_CONTRIBUTOR_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Local storage read error for contributor profile:", e);
  }

  // Default initial profile
  return {
    name: 'Đồng chí Chánh Văn phòng & Cán bộ Cấp ủy',
    title: 'Người Đóng Góp Tri Thức Cấp ủy',
    level: 3,
    levelName: 'Cán bộ Tham mưu Nòng cốt (Cấp 3)',
    totalReviews: 8,
    totalPoints: 160,
    accuracyRating: 98.5,
    badges: ['🎖️ Chuyên gia Quy chế', '⭐ Đóng góp Nổi bật', '🛡️ Thẩm quyền BTV', '📋 Đôn đốc Tiến độ']
  };
}

export function saveContributorProfile(profile: ContributorProfile): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CONTRIBUTOR_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn("Failed to persist contributor profile:", e);
  }
}

export function getSubmittedReviews(): ScenarioReviewSubmission[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_REVIEWS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Failed to read reviews:", e);
  }
  return [];
}

export async function submitScenarioReview(review: Omit<ScenarioReviewSubmission, 'id' | 'submittedAt' | 'pointsEarned'>): Promise<{
  submission: ScenarioReviewSubmission;
  newRule: LearningRule;
  updatedProfile: ContributorProfile;
}> {
  const pointsEarned = review.rating >= 4 ? 25 : 15;
  const submission: ScenarioReviewSubmission = {
    ...review,
    id: `rev-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    pointsEarned
  };

  // 1. Save review to local list
  const existingReviews = getSubmittedReviews();
  const updatedReviews = [submission, ...existingReviews];
  try {
    localStorage.setItem(LOCAL_STORAGE_REVIEWS_KEY, JSON.stringify(updatedReviews));
  } catch (e) {
    console.warn("Failed to write updated reviews:", e);
  }

  // 2. Automatically generate a LearningRule from user's expert decision and store in AI Brain
  const newRuleData: Omit<LearningRule, 'id'> = {
    keywordTrigger: review.keywordTrigger || 'quy chế, tham mưu cấp ủy',
    suggestedLeadDept: review.customRouting || 'Văn phòng Đảng ủy & UBND Phường',
    suggestedAction: review.customDirective || 'Giao cơ quan chủ trì thực hiện theo đúng Quy chế làm việc',
    suggestedDraftType: 'Thông báo Kết luận / Bút phê',
    learnedAt: new Date().toLocaleDateString('vi-VN'),
    confidence: review.rating >= 4 ? 98 : 92,
    useCount: 1,
    isActive: true,
    notes: `Học từ đánh giá đóng góp tình huống Cấp ủy [${review.scenarioTitle}] (Đánh giá ${review.rating} sao)`,
    reviewedBy: review.reviewerName || 'Lãnh đạo Cấp ủy',
    scenarioId: review.scenarioId,
    rating: review.rating
  };

  const newRule = await saveLearnedAdjustmentRule(newRuleData);

  // 3. Update Contributor profile (Level & Badges calculation like Google Maps Local Guides)
  const currentProfile = getContributorProfile();
  const newTotalPoints = currentProfile.totalPoints + pointsEarned;
  const newTotalReviews = currentProfile.totalReviews + 1;

  let newLevel = 1;
  let newLevelName = 'Cán bộ Tập sự (Cấp 1)';
  if (newTotalPoints >= 300) {
    newLevel = 5;
    newLevelName = 'Bậc thầy Tham mưu Cấp ủy (Cấp 5)';
  } else if (newTotalPoints >= 200) {
    newLevel = 4;
    newLevelName = 'Chuyên gia Tham mưu Cấp cao (Cấp 4)';
  } else if (newTotalPoints >= 100) {
    newLevel = 3;
    newLevelName = 'Cán bộ Tham mưu Nòng cốt (Cấp 3)';
  } else if (newTotalPoints >= 40) {
    newLevel = 2;
    newLevelName = 'Chuyên viên Tham mưu (Cấp 2)';
  }

  const updatedBadges = [...currentProfile.badges];
  if (newTotalReviews >= 10 && !updatedBadges.includes('🏆 Cột Mốc 10 Đóng Góp')) {
    updatedBadges.push('🏆 Cột Mốc 10 Đóng Góp');
  }
  if (newTotalPoints >= 200 && !updatedBadges.includes('⚡ Bộ Não Siêu Cấp')) {
    updatedBadges.push('⚡ Bộ Não Siêu Cấp');
  }

  const updatedProfile: ContributorProfile = {
    ...currentProfile,
    totalPoints: newTotalPoints,
    totalReviews: newTotalReviews,
    level: newLevel,
    levelName: newLevelName,
    badges: updatedBadges
  };

  saveContributorProfile(updatedProfile);

  return { submission, newRule, updatedProfile };
}

