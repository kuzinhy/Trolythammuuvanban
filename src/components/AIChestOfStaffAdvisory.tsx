import React, { useState } from 'react';
import { Sparkles, Bot, Send, ShieldAlert, CheckCircle2, FileText, Clock, ChevronRight, ArrowRight, RefreshCw, Lightbulb, AlertTriangle } from 'lucide-react';
import { Document, Task } from '../types';

interface AIChestOfStaffAdvisoryProps {
  documents: Document[];
  tasks: Task[];
  onNavigate?: (path: string) => void;
}

export function AIChestOfStaffAdvisory({ documents, tasks, onNavigate }: AIChestOfStaffAdvisoryProps) {
  const [activeTab, setActiveTab] = useState<'briefing' | 'advisor' | 'recommendations'>('briefing');
  const [chatQuery, setChatQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Kính chào đồng chí Chánh Văn phòng. Tôi là Trợ lý AI chuyên trách Văn phòng Cấp ủy. Hệ thống đang đồng bộ toàn bộ cơ sở dữ liệu văn bản đến và nhiệm vụ đôn đốc. Đồng chí cần tôi hỗ trợ tham mưu vấn đề trọng tâm nào hôm nay?'
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customBriefing, setCustomBriefing] = useState<string | null>(null);

  // Compute smart insights
  const urgentDocs = documents.filter(d => d.urgency && d.urgency !== 'Thường');
  const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED');
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'COMPLETED' || !t.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  });

  const handleGenerateBriefing = async () => {
    setIsGenerating(true);
    try {
      const summaryPayload = {
        totalDocs: documents.length,
        urgentCount: urgentDocs.length,
        pendingTasksCount: pendingTasks.length,
        overdueCount: overdueTasks.length,
        recentDocs: documents.slice(0, 5).map(d => ({ title: d.title, issuer: d.issuer || d.leadDepartment, urgency: d.urgency })),
        recentTasks: overdueTasks.slice(0, 5).map(t => ({ title: t.title, assignee: t.assignedOrganization, dueDate: t.dueDate }))
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Dựa trên dữ liệu Văn phòng Đảng ủy: ${JSON.stringify(summaryPayload)}. Hãy đóng vai Trợ lý Chánh Văn phòng cấp cao, soạn một "Báo cáo điều hành nhanh buổi sáng" chuẩn mực, sắc sảo dành riêng cho Chánh Văn phòng Đảng ủy, gồm: 1. Đánh giá tình hình văn bản đến & nhiệm vụ; 2. Các điểm nóng cần Thường trực Ban Thường vụ cho ý kiến ngay; 3. Đề xuất phương án phân luồng & đôn đốc cụ thể. Viết bằng văn phong hành chính đảng sắc bén, ngắn gọn, chuyên nghiệp.`
        })
      });

      const data = await res.json();
      if (data.reply) {
        setCustomBriefing(data.reply);
      }
    } catch (e) {
      console.error("Error generating briefing:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatQuery.trim() || isGenerating) return;

    const queryText = chatQuery.trim();
    setChatQuery('');
    setChatHistory(prev => [...prev, { role: 'user', content: queryText }]);
    setIsGenerating(true);

    try {
      const contextData = {
        docsSummary: documents.slice(0, 10).map(d => ({ id: d.id, title: d.title, leadDept: d.leadDepartment, urgency: d.urgency })),
        tasksSummary: tasks.slice(0, 10).map(t => ({ title: t.title, dept: t.assignedOrganization, status: t.status, dueDate: t.dueDate }))
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Hỏi đáp Chánh Văn phòng Đảng ủy. Dữ liệu hệ thống hiện tại: ${JSON.stringify(contextData)}. Câu hỏi của Chánh VP: "${queryText}". Hãy trả lời với tư cách Trợ lý Chánh Văn phòng, đưa ra tham mưu chính xác, chính quy và đúng quy chế làm việc.`
        })
      });

      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply || 'Xin lỗi đồng chí, tôi chưa thể tổng hợp ngay lúc này.' }]);
    } catch (e) {
      console.error("Chat error:", e);
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Đã xảy ra lỗi kết nối khi phân tích dữ liệu.' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-2xl text-white shadow-xl border border-blue-800/50 overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="px-6 py-4 bg-blue-950/80 border-b border-blue-800/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-400/20 text-amber-300 rounded-xl border border-amber-400/30">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-600/40 text-blue-200 rounded-md border border-blue-500/30">
                AI Chief of Staff
              </span>
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Trực tuyến 24/7
              </span>
            </div>
            <h2 className="text-base font-black text-white uppercase tracking-wide mt-0.5">
              Trung tâm Trợ lý Ảo Chánh Văn phòng Đảng ủy
            </h2>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-blue-900/80">
          <button
            onClick={() => setActiveTab('briefing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'briefing' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Báo cáo điều hành
          </button>
          <button
            onClick={() => setActiveTab('advisor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'advisor' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Hỏi đáp tham mưu AI
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'recommendations' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Gợi ý trọng tâm ({overdueTasks.length + urgentDocs.length})
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-6">
        {/* Tab 1: Briefing */}
        {activeTab === 'briefing' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-blue-900/30 p-4 rounded-xl border border-blue-700/40">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-blue-200 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-300" />
                  <span>Báo cáo điều hành thông minh tự động dành cho Chánh Văn phòng</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Tổng hợp toàn diện từ {documents.length} văn bản đến và {tasks.length} nhiệm vụ đôn đốc trong hệ thống.
                </p>
              </div>
              <button
                onClick={handleGenerateBriefing}
                disabled={isGenerating}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/25 disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{customBriefing ? 'Làm mới báo cáo AI' : 'Khởi tạo Báo cáo Sáng nay'}</span>
              </button>
            </div>

            {customBriefing ? (
              <div className="bg-slate-950/70 p-5 rounded-xl border border-blue-800/60 space-y-4 text-slate-100 text-sm leading-relaxed">
                <div className="flex items-center justify-between pb-3 border-b border-blue-900/80">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Bản tin tham mưu điều hành chính thức — {new Date().toLocaleDateString('vi-VN')}
                  </span>
                  <span className="text-[11px] text-slate-400">Được tổng hợp bởi Trợ lý Gemini AI</span>
                </div>
                <div className="whitespace-pre-wrap font-normal text-xs md:text-sm leading-relaxed space-y-2">
                  {customBriefing}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Văn bản Khẩn cấp</span>
                    <span className="p-1.5 bg-red-500/20 text-red-400 rounded-lg">
                      <ShieldAlert className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">{urgentDocs.length}</div>
                  <p className="text-[11px] text-slate-400">Cần ưu tiên trình Thường trực Ban Thường vụ ngay.</p>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Nhiệm vụ Đang thực hiện</span>
                    <span className="p-1.5 bg-blue-500/20 text-blue-300 rounded-lg">
                      <Clock className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">{pendingTasks.length}</div>
                  <p className="text-[11px] text-slate-400">Nhiệm vụ đang đôn đốc các cơ quan chủ trì.</p>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Nhiệm vụ Quá hạn</span>
                    <span className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">{overdueTasks.length}</div>
                  <p className="text-[11px] text-slate-400">Cần văn phòng phát phiếu nhắc nhở khẩn.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Advisor Chat */}
        {activeTab === 'advisor' && (
          <div className="space-y-4">
            <div className="bg-slate-950/70 rounded-xl border border-blue-950 p-4 h-72 overflow-y-auto space-y-3">
              {chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center flex-shrink-0 text-blue-300">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-xl p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-900 text-slate-200 border border-blue-900/60 rounded-tl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed space-y-1.5">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex gap-3 items-center text-xs text-slate-400 italic">
                  <Bot className="w-4 h-4 animate-bounce text-blue-400" />
                  <span>Trợ lý AI đang tra cứu văn bản và soạn ý kiến tham mưu...</span>
                </div>
              )}
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="flex flex-wrap gap-2">
              {[
                'Tổng hợp văn bản Tỉnh ủy gửi đến tuần này',
                'Nhiệm vụ nào của Ban Tổ chức đã quá hạn?',
                'Soạn nội dung kết luận họp Thường trực',
                'Kiểm tra tiến độ các chỉ đạo của Bí thư'
              ].map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setChatQuery(prompt);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-900/40 hover:bg-blue-900/80 text-blue-200 border border-blue-800/60 text-xs transition-all cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder="Nhập câu hỏi tham mưu cho Trợ lý Chánh Văn phòng..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isGenerating || !chatQuery.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Gửi</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Recommendations */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Danh sách các vấn đề trọng tâm cần Chánh Văn phòng chỉ đạo xử lý ngay
            </h3>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {overdueTasks.map((t, idx) => (
                <div key={idx} className="bg-slate-900/80 p-3.5 rounded-xl border border-red-900/50 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-[10px] font-bold rounded">Quá hạn</span>
                      <span className="text-xs font-bold text-white">{t.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Đơn vị chủ trì: {t.assignedOrganization || 'Chưa phân công'} • Hạn: {t.dueDate}</p>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('/tasks')}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      <span>Xử lý</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {urgentDocs.map((d, idx) => (
                <div key={idx} className="bg-slate-900/80 p-3.5 rounded-xl border border-amber-900/50 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded">Độ khẩn: {d.urgency}</span>
                      <span className="text-xs font-bold text-white">{d.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Cơ quan ban hành: {d.issuer || d.leadDepartment} • Đề xuất: {d.proposedAction || 'Trình Thường trực'}</p>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('/documents')}
                      className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      <span>Xem văn bản</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {overdueTasks.length === 0 && urgentDocs.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  Tuyệt vời! Không có nhiệm vụ quá hạn hoặc văn bản khẩn cấp tồn đọng.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
