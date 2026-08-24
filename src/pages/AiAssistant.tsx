import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Bot, Send, ShieldAlert, CheckCircle2, FileText, Clock, 
  ChevronRight, ArrowRight, RefreshCw, AlertTriangle, 
  CheckSquare, Users, Building2, Play, Pause, Volume2, ShieldCheck, Link2,
  Calendar, Eye
} from 'lucide-react';
import { db, collection, getDocs, query, orderBy, limit } from '../lib/firebase';
import { CrossAppInteroperabilityCenter } from '../components/CrossAppInteroperabilityCenter';
import { WeeklyScheduleGenerator } from '../components/WeeklyScheduleGenerator';
import { MeetingNoticeGenerator } from '../components/MeetingNoticeGenerator';
import { MultimodalAnalyticsCenter } from '../components/MultimodalAnalyticsCenter';
import { Document, Task } from '../types';

export default function AiAssistant() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'briefing' | 'advisor' | 'schedule' | 'notice' | 'multimodal' | 'interop' | 'triage'>('briefing');
  
  const [chatQuery, setChatQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Kính chào đồng chí Chánh Văn phòng. Tôi là Trung tâm Trợ lý ảo AI chuyên trách Văn phòng Cấp ủy. Hệ thống đang trực tuyến đồng bộ 100% cơ sở dữ liệu văn bản, nhiệm vụ và lịch công tác. Đồng chí cần tôi hỗ trợ tham mưu chiến lược, tổng hợp báo cáo hay đôn đốc các nhiệm vụ trọng tâm nào hôm nay?'
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customBriefing, setCustomBriefing] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Fetch real documents and tasks from Firestore
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const docsSnap = await getDocs(query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(100)));
        const docs = docsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
        setDocuments(docs);

        const tasksSnap = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(100)));
        const ts = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        setTasks(ts);
      } catch (err) {
        console.error("Error fetching data for AI Assistant:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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

  const handleSendChat = async (e?: React.FormEvent, presetQuery?: string) => {
    if (e) e.preventDefault();
    const queryText = presetQuery || chatQuery.trim();
    if (!queryText || isGenerating) return;

    if (!presetQuery) setChatQuery('');
    const newChatHistory = [...chatHistory, { role: 'user' as const, content: queryText }];
    setChatHistory(newChatHistory);
    setIsGenerating(true);

    try {
      const refDocs = documents.filter(d => 
        d.isReferenceDoc || 
        (d.tags || []).includes('TRA_CUU_THAM_KHAO') || 
        (d.tags || []).includes('Văn bản tra cứu') || 
        !!d.referenceCategory
      );

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newChatHistory,
          contextDocs: documents.slice(0, 10),
          referenceDocs: refDocs.slice(0, 8),
          tasks: tasks.slice(0, 10)
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

  const toggleAudioSimulation = () => {
    setIsPlayingAudio(!isPlayingAudio);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in font-sans">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 rounded-3xl text-white shadow-xl border border-blue-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-400/20 text-amber-300 rounded-2xl border border-amber-400/30 shadow-inner">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-blue-600/50 text-blue-200 rounded-md border border-blue-500/30">
                AI Chief of Staff Center
              </span>
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Đang trực tuyến (Gemini Pro)
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide">
              Trung tâm Trợ lý Ảo Chánh Văn phòng
            </h1>
            <p className="text-xs text-blue-200/80 mt-0.5">
              Hệ thống trí tuệ nhân tạo chuyên biệt hỗ trợ Chánh Văn phòng điều hành, tổng hợp báo cáo và đôn đốc nhiệm vụ cấp ủy
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setActiveTab('interop')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all ${
              activeTab === 'interop' 
                ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400/50' 
                : 'bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/50'
            }`}
          >
            <Link2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Tra cứu CSDL 2 Web</span>
          </button>

          <button
            onClick={toggleAudioSimulation}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all ${
              isPlayingAudio ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
          >
            {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            <span>{isPlayingAudio ? 'Dừng phát Audio Briefing' : 'Nghe tóm tắt Audio'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs - GenZ High-Tech Glassmorphism Style */}
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-slate-200/90 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('briefing')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'briefing' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-blue-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Báo cáo Điều hành Nhanh</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'schedule' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-blue-700'
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-300" />
          <span>Tự Động Lịch Tuần AI</span>
        </button>

        <button
          onClick={() => setActiveTab('notice')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'notice' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-blue-700'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-300" />
          <span>Dự Thảo Thông Báo Kết Luận</span>
        </button>

        <button
          onClick={() => setActiveTab('multimodal')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'multimodal' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-blue-700'
          }`}
        >
          <Eye className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>Phân Tích Đa Phương Thức</span>
        </button>

        <button
          onClick={() => setActiveTab('advisor')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'advisor' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-blue-700'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Hỏi đáp Tham mưu Chuyên sâu</span>
        </button>

        <button
          onClick={() => setActiveTab('interop')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'interop' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-blue-700'
          }`}
        >
          <Link2 className="w-4 h-4 text-emerald-400" />
          <span>Tra cứu CSDL 2 Web</span>
        </button>

        <button
          onClick={() => setActiveTab('triage')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'triage' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]' 
              : 'text-slate-600 hover:bg-slate-100/80 hover:text-blue-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span>Triage Điểm nóng ({urgentDocs.length + overdueTasks.length})</span>
        </button>
      </div>

      {/* TAB 1: BRIEFING */}
      {activeTab === 'briefing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900 uppercase">Báo cáo Giao ban Buổi sáng (Executive Briefing)</h2>
                  <p className="text-xs text-slate-500">Tự động tổng hợp và phân tích đa nguồn từ CSDL Văn phòng Đảng ủy</p>
                </div>
                <button
                  onClick={handleGenerateBriefing}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{isGenerating ? 'Đang tổng hợp AI...' : 'Tạo mới Báo cáo AI'}</span>
                </button>
              </div>

              {customBriefing ? (
                <div className="bg-blue-50/60 p-6 rounded-2xl border border-blue-200/80 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-medium shadow-2xs">
                  {customBriefing}
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-slate-700 text-sm leading-relaxed space-y-4">
                  <p className="font-bold text-blue-900">Kính gửi đồng chí Chánh Văn phòng, đây là tóm tắt điều hành tự động trong ngày:</p>
                  <ul className="list-disc pl-5 space-y-2 text-xs text-slate-700">
                    <li>Tổng số văn bản đang theo dõi: <strong className="text-slate-900">{documents.length}</strong> văn bản (trong đó có <strong className="text-red-600">{urgentDocs.length}</strong> văn bản khẩn/hỏa tốc).</li>
                    <li>Nhiệm vụ đôn đốc cần lưu ý: <strong className="text-slate-900">{pendingTasks.length}</strong> nhiệm vụ đang thực hiện, trong đó có <strong className="text-amber-600">{overdueTasks.length}</strong> nhiệm vụ quá hạn.</li>
                    <li>Khuyến nghị xử lý ngay: Tập trung chỉ đạo rà soát các văn bản đến từ Ban Nội chính và Ban Tổ chức Tỉnh ủy; đôn đốc các phòng ban gửi báo cáo trước 16:00 chiều nay.</li>
                  </ul>
                  <div className="pt-2">
                    <button
                      onClick={handleGenerateBriefing}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1.5"
                    >
                      <span>Bấm để yêu cầu Gemini Pro phân tích chi tiết toàn văn</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Metrics */}
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Chỉ số Trọng tâm Hệ thống</h3>
              
              <div className="space-y-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Văn bản mới</div>
                      <div className="text-[10px] text-slate-500">Trong hệ thống trực tuyến</div>
                    </div>
                  </div>
                  <span className="text-lg font-black text-blue-600">{documents.length}</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Văn bản Khẩn</div>
                      <div className="text-[10px] text-slate-500">Yêu cầu xử lý gấp</div>
                    </div>
                  </div>
                  <span className="text-lg font-black text-amber-600">{urgentDocs.length}</span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Nhiệm vụ Quá hạn</div>
                      <div className="text-[10px] text-slate-500">Cần đôn đốc ngay</div>
                    </div>
                  </div>
                  <span className="text-lg font-black text-red-600">{overdueTasks.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADVISOR Q&A */}
      {activeTab === 'advisor' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-black text-slate-900 uppercase">Hỏi đáp Tham mưu Chuyên sâu cùng Trợ lý AI</h2>
            <p className="text-xs text-slate-500">Đặt câu hỏi trực tiếp để được tư vấn quy trình, dự thảo ý kiến hoặc tổng hợp số liệu</p>
          </div>

          {/* Preset Queries */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSendChat(undefined, "Đồng chí hãy tổng hợp danh sách các văn bản khẩn cấp chưa hoàn thành xử lý trong tuần này.")}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold border border-blue-200 transition-all"
            >
              💡 Tổng hợp văn bản khẩn cấp cần chú ý
            </button>
            <button
              onClick={() => handleSendChat(undefined, "Đề xuất phương án đôn đốc các phòng ban đối với các nhiệm vụ đang bị quá hạn thời hạn.")}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-semibold border border-amber-200 transition-all"
            >
              💡 Phương án xử lý nhiệm vụ quá hạn
            </button>
            <button
              onClick={() => handleSendChat(undefined, "Tóm tắt quy chế làm việc của Thường trực Ban Thường vụ liên quan đến công tác ban hành văn bản.")}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-200 transition-all"
            >
              💡 Quy chế làm việc Thường trực
            </button>
          </div>

          {/* Chat Stream */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-200">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-2xl p-4 rounded-2xl text-xs leading-relaxed font-medium ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none shadow-sm' 
                    : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-2xs'
                }`}>
                  <div className="whitespace-pre-wrap space-y-1.5">{msg.content}</div>
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex gap-3 items-center text-blue-600 text-xs font-bold py-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Trợ lý AI đang tra cứu CSDL và soạn thảo tham mưu...</span>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={(e) => handleSendChat(e)} className="flex items-center gap-3">
            <input
              type="text"
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              placeholder="Nhập câu hỏi tham mưu cho Chánh Văn phòng..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={isGenerating || !chatQuery.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Gửi tham mưu</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB: WEEKLY SCHEDULE GENERATOR */}
      {activeTab === 'schedule' && (
        <WeeklyScheduleGenerator documents={documents} tasks={tasks} />
      )}

      {/* TAB: MEETING NOTICE GENERATOR */}
      {activeTab === 'notice' && (
        <MeetingNoticeGenerator />
      )}

      {/* TAB: MULTIMODAL ANALYTICS */}
      {activeTab === 'multimodal' && (
        <MultimodalAnalyticsCenter />
      )}

      {/* TAB: CSDL INTEROPERABILITY */}
      {activeTab === 'interop' && (
        <CrossAppInteroperabilityCenter embedded={true} />
      )}

      {/* TAB 3: TRIAGE */}
      {activeTab === 'triage' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-black text-slate-900 uppercase">Triage Điểm nóng & Nhiệm vụ Quá hạn</h2>
            <p className="text-xs text-slate-500">Danh sách các văn bản khẩn và nhiệm vụ quá hạn cần Chánh Văn phòng trực tiếp cho ý kiến chỉ đạo</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="bg-red-50/60 p-5 rounded-2xl border border-red-200 space-y-3">
                <h3 className="text-xs font-black text-red-900 uppercase flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Văn bản Khẩn / Hỏa tốc ({urgentDocs.length})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {urgentDocs.map(doc => (
                    <div key={doc.id} className="bg-white p-3 rounded-xl border border-red-100 shadow-2xs">
                      <div className="text-xs font-bold text-slate-900 truncate">{doc.title}</div>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>Đơn vị: {doc.leadDepartment || doc.issuer}</span>
                        <span className="text-red-600 font-bold">{doc.urgency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200 space-y-3">
                <h3 className="text-xs font-black text-amber-900 uppercase flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Nhiệm vụ Quá hạn đôn đốc ({overdueTasks.length})</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {overdueTasks.map(t => (
                    <div key={t.id} className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs">
                      <div className="text-xs font-bold text-slate-900 truncate">{t.title}</div>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>Đơn vị: {t.assignedOrganization}</span>
                        <span className="text-red-600 font-bold">Hạn: {t.dueDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
