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
}

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
