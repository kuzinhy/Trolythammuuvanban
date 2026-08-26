import { useState } from 'react';
import { 
  useUserInteractionStore, 
  AdministrativeStyle, 
  DocumentTone 
} from '../store/userInteractionStore';
import { 
  Brain, Settings2, History, ThumbsUp, ThumbsDown, 
  RotateCcw, Sparkles, CheckCircle2, Sliders, ShieldCheck, FileText, Trash2
} from 'lucide-react';

export function InteractionMemoryPanel() {
  const { 
    preferences, 
    history, 
    updatePreferences, 
    resetPreferences, 
    setFeedback, 
    clearHistory 
  } = useUserInteractionStore();

  const [activeTab, setActiveTab] = useState<'preferences' | 'history'>('preferences');
  const [customNoteInput, setCustomNoteInput] = useState(preferences.customSystemInstructionSnippet || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const styleOptions: { id: AdministrativeStyle; title: string; desc: string }[] = [
    {
      id: 'CHIEF_OF_STAFF',
      title: 'Trợ lý Chánh Văn phòng Cấp ủy',
      desc: 'Điểm nóng điều hành, phân công nhiệm vụ & dự thảo bút phê Thường trực'
    },
    {
      id: 'PARTY_DEPUTY',
      title: 'Phó Bí thư Thường trực',
      desc: 'Định hướng chỉ đạo chính trị toàn diện, kết luận các nội dung trọng tâm'
    },
    {
      id: 'LEGAL_EXPERT',
      title: 'Chuyên viên Kiểm tra / Pháp chế',
      desc: 'Chặt chẽ Căn cứ pháp lý, Điều lệ Đảng & Quy chế làm việc'
    },
    {
      id: 'ADMINISTRATIVE_SPECIALIST',
      title: 'Chuyên viên Tổng hợp Hành chính',
      desc: 'Chuẩn thể thức Nghị định 30/2020/NĐ-CP & Quy định 66-QĐ/TW'
    }
  ];

  const toneOptions: { id: DocumentTone; title: string; desc: string }[] = [
    {
      id: 'SAC_BEN_CHINH_XAC',
      title: 'Sắc bén & Chính xác Quy chế',
      desc: 'Căn cứ chuẩn xác quy chế làm việc, giao thẩm quyền rõ ràng'
    },
    {
      id: 'NGAN_GON_SUC_TICH',
      title: 'Ngắn gọn, Súc tích',
      desc: 'Tóm tắt trọng tâm, cắt bỏ thông tin rườm rà, tối ưu thời gian Lãnh đạo'
    },
    {
      id: 'CHUAN_QUY_DINH_30',
      title: 'Thần tốc Thể thức Hành chính',
      desc: 'Đúng thể thức công văn, tờ trình, thông báo kết luận chuẩn quy định'
    },
    {
      id: 'MEM_MAI_VAN_DONG',
      title: 'Linh hoạt & Tuyên truyền',
      desc: 'Văn phong mềm mỏng, mang tính thuyết phục, dân vận'
    }
  ];

  const handleSaveCustomNote = () => {
    updatePreferences({ customSystemInstructionSnippet: customNoteInput });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-5 text-white flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 backdrop-blur-md rounded-xl border border-blue-400/30">
            <Brain className="w-6 h-6 text-cyan-300 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              Bộ Nhớ Tương Tác & Tùy Chọn Định Dạng AI
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Zustand Store
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Ghi nhớ tự động phong cách tham mưu, thể thức văn bản ưa thích & lịch sử tương tác
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'preferences' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Tùy Chọn Văn Phong
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'history' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Lịch Sử & Đánh Giá ({history.length})
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {activeTab === 'preferences' ? (
          <div className="space-y-6">
            {/* Vai trò tham mưu mặc định */}
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5 mb-3">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Vai Trò Tham Mưu Ưu Thích
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {styleOptions.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => updatePreferences({ preferredStyle: item.id })}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      preferences.preferredStyle === item.id
                        ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">{item.title}</span>
                      {preferences.preferredStyle === item.id && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Phong cách / Giọng văn hành chính */}
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5 mb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Sắc Thái & Phong Cách Trình Bày Văn Bản
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {toneOptions.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => updatePreferences({ documentTone: item.id })}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      preferences.documentTone === item.id
                        ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">{item.title}</span>
                      {preferences.documentTone === item.id && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quyết định Định dạng & Thể thức */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-600" />
                Cấu Hình Định Dạng & Thể Thức Xuất Văn Bản
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer text-xs font-medium text-slate-700 hover:border-blue-300">
                  <input
                    type="checkbox"
                    checked={preferences.includeLegalBasis}
                    onChange={(e) => updatePreferences({ includeLegalBasis: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Tự động đính kèm Căn cứ Pháp lý & Điều lệ</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer text-xs font-medium text-slate-700 hover:border-blue-300">
                  <input
                    type="checkbox"
                    checked={preferences.autoAddAuthorityRouting}
                    onChange={(e) => updatePreferences({ autoAddAuthorityRouting: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Bắt buộc gợi ý Phân luồng Thẩm quyền Cấp ủy</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer text-xs font-medium text-slate-700 hover:border-blue-300">
                  <input
                    type="checkbox"
                    checked={preferences.highlightKeywords}
                    onChange={(e) => updatePreferences({ highlightKeywords: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Tự động bôi đậm Từ khóa & Cơ quan Chủ trì</span>
                </label>

                <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-700">
                  <span className="text-slate-500">Định dạng file xuất:</span>
                  <select
                    value={preferences.exportFormatPreference}
                    onChange={(e) => updatePreferences({ exportFormatPreference: e.target.value as any })}
                    className="bg-slate-100 text-slate-800 rounded px-2 py-1 font-bold border border-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="docx">Microsoft Word (.docx)</option>
                    <option value="pdf">Tài liệu PDF (.pdf)</option>
                    <option value="markdown">Markdown chuẩn (.md)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Custom Instruction / Ghi chú riêng cho AI */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Chỉ Đạo Hoặc Lưu Ý Riêng Dành Cho AI (Personal System Instructions):</span>
                {savedSuccess && (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1 animate-fade-in text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu ghi chú!
                  </span>
                )}
              </label>
              <textarea
                value={customNoteInput}
                onChange={(e) => setCustomNoteInput(e.target.value)}
                placeholder="Ví dụ: Lãnh đạo yêu cầu luôn nhấn mạnh thời hạn hoàn thành trước ngày 20 hàng tháng; hoặc Ưu tiên giao UBND xử lý phản ánh đô thị..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 placeholder:text-slate-400"
              />
              <div className="flex justify-between items-center pt-1">
                <button
                  onClick={resetPreferences}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Khôi phục mặc định
                </button>

                <button
                  onClick={handleSaveCustomNote}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Lưu Ghi Chú AI
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* History & Feedback Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-600">
                Lịch sử {history.length} lần tương tác gần nhất được ghi nhớ tự động
              </span>

              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa lịch sử
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                Chưa có lịch sử tương tác nào. Khi đồng chí hỏi Trợ lý AI, phản hồi và tùy chọn sẽ xuất hiện tại đây.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 hover:bg-slate-100/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-slate-800 line-clamp-2">
                        "{item.promptSummary}"
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">
                          {item.selectedRole}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span>Phong cách: {item.styleUsed}</span>
                      </div>

                      {/* Feedback action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setFeedback(item.id, 'LIKED')}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            item.userFeedback === 'LIKED'
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-700 font-bold'
                              : 'bg-white border-slate-200 text-slate-500 hover:text-emerald-600'
                          }`}
                          title="Hài lòng với kết quả (AI sẽ ưu tiên phong cách này)"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setFeedback(item.id, 'DISLIKED')}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            item.userFeedback === 'DISLIKED'
                              ? 'bg-red-100 border-red-400 text-red-700 font-bold'
                              : 'bg-white border-slate-200 text-slate-500 hover:text-red-600'
                          }`}
                          title="Chưa hài lòng"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
