import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AdministrativeStyle = 
  | 'CHIEF_OF_STAFF'           // Trợ lý Chánh Văn phòng Đảng ủy
  | 'PARTY_DEPUTY'              // Phó Bí thư Thường trực
  | 'LEGAL_EXPERT'              // Chuyên viên Pháp chế / Kiểm tra
  | 'ADMINISTRATIVE_SPECIALIST' // Chuyên viên Tổng hợp Hành chính;

export type DocumentTone = 
  | 'SAC_BEN_CHINH_XAC'   // Sắc bén, chuẩn xác quy chế
  | 'NGAN_GON_SUC_TICH'   // Tóm tắt ngắn gọn, chỉ có trọng tâm
  | 'CHUAN_QUY_DINH_30'   // Chuẩn thể thức Nghị định 30/2020/NĐ-CP & Quy định Đảng
  | 'MEM_MAI_VAN_DONG';   // Tuyên truyền, vận động quần chúng

export interface UserFormattingPreferences {
  preferredStyle: AdministrativeStyle;
  documentTone: DocumentTone;
  includeLegalBasis: boolean;
  autoAddAuthorityRouting: boolean;
  exportFormatPreference: 'docx' | 'pdf' | 'markdown';
  highlightKeywords: boolean;
  customSystemInstructionSnippet?: string;
}

export interface InteractionRecord {
  id: string;
  timestamp: number;
  promptSummary: string;
  selectedRole: AdministrativeStyle;
  styleUsed: DocumentTone;
  legalBasisIncluded: boolean;
  userFeedback?: 'LIKED' | 'DISLIKED' | 'EDITED' | null;
  userCorrectionNote?: string;
}

interface UserInteractionState {
  preferences: UserFormattingPreferences;
  history: InteractionRecord[];

  // Actions
  updatePreferences: (newPrefs: Partial<UserFormattingPreferences>) => void;
  resetPreferences: () => void;
  addInteractionRecord: (record: Omit<InteractionRecord, 'id' | 'timestamp'>) => void;
  setFeedback: (id: string, feedback: 'LIKED' | 'DISLIKED' | 'EDITED', note?: string) => void;
  clearHistory: () => void;
  getFormattedPromptContext: () => string;
}

const DEFAULT_PREFERENCES: UserFormattingPreferences = {
  preferredStyle: 'CHIEF_OF_STAFF',
  documentTone: 'SAC_BEN_CHINH_XAC',
  includeLegalBasis: true,
  autoAddAuthorityRouting: true,
  exportFormatPreference: 'docx',
  highlightKeywords: true,
  customSystemInstructionSnippet: ''
};

export const useUserInteractionStore = create<UserInteractionState>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFERENCES,
      history: [],

      updatePreferences: (newPrefs) => set((state) => ({
        preferences: { ...state.preferences, ...newPrefs }
      })),

      resetPreferences: () => set({ preferences: DEFAULT_PREFERENCES }),

      addInteractionRecord: (record) => set((state) => {
        const newRecord: InteractionRecord = {
          ...record,
          id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          timestamp: Date.now()
        };
        // Keep last 50 interaction records
        const updatedHistory = [newRecord, ...state.history].slice(0, 50);
        return { history: updatedHistory };
      }),

      setFeedback: (id, feedback, note) => set((state) => ({
        history: state.history.map((item) =>
          item.id === id
            ? { ...item, userFeedback: feedback, userCorrectionNote: note || item.userCorrectionNote }
            : item
        )
      })),

      clearHistory: () => set({ history: [] }),

      // Generate a rich prompt context string that can be sent to AI backend
      getFormattedPromptContext: () => {
        const { preferences, history } = get();

        const styleMap: Record<AdministrativeStyle, string> = {
          CHIEF_OF_STAFF: 'Trợ lý Chánh Văn phòng Cấp ủy (sắc bén, đề xuất thẩm quyền rõ ràng)',
          PARTY_DEPUTY: 'Phó Bí thư Thường trực (chỉ đạo toàn diện, định hướng chính trị)',
          LEGAL_EXPERT: 'Chuyên viên Pháp chế / Kiểm tra (chặt chẽ căn cứ pháp lý & Điều lệ)',
          ADMINISTRATIVE_SPECIALIST: 'Chuyên viên Tổng hợp Hành chính (chuẩn thể thức Nghị định 30)'
        };

        const toneMap: Record<DocumentTone, string> = {
          SAC_BEN_CHINH_XAC: 'Sắc bén, chính xác theo Quy chế làm việc',
          NGAN_GON_SUC_TICH: 'Ngắn gọn, súc tích, đi thẳng vào bản chất vấn đề',
          CHUAN_QUY_DINH_30: 'Chuẩn thể thức Nghị định 30/2020/NĐ-CP và văn bản Đảng',
          MEM_MAI_VAN_DONG: 'Linh hoạt, mang tính vận động và thuyết phục'
        };

        let contextPrompt = `\n--- CẤU HÌNH PHONG CÁCH VÀ TÙY CHỌN ƯA THÍCH CỦA NGƯỜI DÙNG (USER INTERACTION MEMORY) ---\n`;
        contextPrompt += `- Vai trò tham mưu ưu thích: ${styleMap[preferences.preferredStyle]}\n`;
        contextPrompt += `- Phong cách văn phong ưa thích: ${toneMap[preferences.documentTone]}\n`;
        contextPrompt += `- Yêu cầu trích dẫn Căn cứ pháp lý: ${preferences.includeLegalBasis ? 'Bắt buộc kèm theo' : 'Không bắt buộc'}\n`;
        contextPrompt += `- Yêu cầu tự động phân luồng Thẩm quyền: ${preferences.autoAddAuthorityRouting ? 'Đưa ra cơ quan chủ trì / phối hợp / trình BTV' : 'Không bắt buộc'}\n`;
        contextPrompt += `- Định dạng xuất ưa thích: ${preferences.exportFormatPreference.toUpperCase()}\n`;

        if (preferences.customSystemInstructionSnippet) {
          contextPrompt += `- Ghi chú phong cách riêng của Lãnh đạo: "${preferences.customSystemInstructionSnippet}"\n`;
        }

        // Add recent liked examples / feedback for context memory
        const likedRecords = history.filter((h) => h.userFeedback === 'LIKED').slice(0, 3);
        if (likedRecords.length > 0) {
          contextPrompt += `\n- Lịch sử tương tác được đánh giá cao trước đây:\n`;
          likedRecords.forEach((rec, idx) => {
            contextPrompt += `  + [Mẫu ${idx + 1}] Yêu cầu: "${rec.promptSummary}" | Phong cách: ${rec.styleUsed} ${rec.userCorrectionNote ? `| Lời khuyên: ${rec.userCorrectionNote}` : ''}\n`;
          });
        }

        return contextPrompt;
      }
    }),
    {
      name: 'trolycvp_user_interaction_memory',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
