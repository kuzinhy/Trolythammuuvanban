import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Bot, Send, ShieldAlert, CheckCircle2, FileText, Clock, 
  ChevronRight, ArrowRight, RefreshCw, AlertTriangle, 
  CheckSquare, Users, Building2, Play, Pause, Volume2, ShieldCheck, Link2,
  Calendar, Eye, Copy, Check, RotateCcw, Download, Brain, Sliders
} from 'lucide-react';
import Markdown from 'react-markdown';
import { db, collection, getDocs, query, orderBy, limit } from '../lib/firebase';
import { getActiveLearningRules, LearningRule } from '../lib/learningEngine';
import { useUserInteractionStore } from '../store/userInteractionStore';
import { InteractionMemoryPanel } from '../components/InteractionMemoryPanel';
import { CrossAppInteroperabilityCenter } from '../components/CrossAppInteroperabilityCenter';
import { WeeklyScheduleGenerator } from '../components/WeeklyScheduleGenerator';
import { MeetingNoticeGenerator } from '../components/MeetingNoticeGenerator';
import { MultimodalAnalyticsCenter } from '../components/MultimodalAnalyticsCenter';
import DailyScenarioTraining from '../components/DailyScenarioTraining';
import AssistantTrainer from '../components/AssistantTrainer';
import { Document, Task } from '../types';
import { safeFetchJson } from '../lib/safeFetch';

export default function AiAssistant() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'briefing' | 'advisor' | 'finetune' | 'training' | 'schedule' | 'notice' | 'multimodal' | 'interop' | 'triage' | 'memory'>('briefing');
  const [selectedRole, setSelectedRole] = useState<'GENERAL' | 'ROUTING_AUTHORITY' | 'DIRECTIVE_DRAFTING' | 'LEGAL_AUDIT'>('GENERAL');
  const [selectedDocId, setSelectedDocId] = useState<string>('ALL');

  const { preferences, getFormattedPromptContext, addInteractionRecord } = useUserInteractionStore();
  
  const [chatQuery, setChatQuery] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Kính chào đồng chí Cán bộ Lãnh đạo. Tôi là **Trợ lý AI Tham mưu Cấp ủy**, đã được nạp và đồng bộ **100% dữ liệu từ Thư mục Tri thức Google Drive** (`1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR`), bao gồm: Quy chế làm việc Đảng bộ, Thẩm quyền Ban Thường vụ & UBND, Nghị định 30/2020/NĐ-CP, Quy định 66-QĐ/TW và Bộ mẫu Bút phê chỉ đạo. Đồng chí cần tôi hỗ trợ tham mưu nội dung nào?'
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customBriefing, setCustomBriefing] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [learnedRules, setLearnedRules] = useState<LearningRule[]>([]);
  const [trainingDatasets, setTrainingDatasets] = useState<any[]>([]);

  const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR";

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

        // Fetch active learned rules & fine-tuning golden dataset pairs for AI Brain
        const rules = await getActiveLearningRules();
        setLearnedRules(rules);

        const dsSnap = await getDocs(query(collection(db, 'ai_training_datasets'), orderBy('createdAt', 'desc'), limit(20)));
        if (!dsSnap.empty) {
          const dsData = dsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTrainingDatasets(dsData);
        }
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

      const res = await safeFetchJson<{ reply: string }>('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Dựa trên dữ liệu Văn phòng Đảng ủy: ${JSON.stringify(summaryPayload)}. Hãy đóng vai Trợ lý Chánh Văn phòng cấp cao, soạn một "Báo cáo điều hành nhanh buổi sáng" chuẩn mực, sắc sảo dành riêng cho Chánh Văn phòng Đảng ủy, gồm: 1. Đánh giá tình hình văn bản đến & nhiệm vụ; 2. Các điểm nóng cần Thường trực Ban Thường vụ cho ý kiến ngay; 3. Đề xuất phương án phân luồng & đôn đốc cụ thể. Viết bằng văn phong hành chính đảng sắc bén, ngắn gọn, chuyên nghiệp.`,
          learnedRules: learnedRules.slice(0, 15),
          trainingDatasets: trainingDatasets.slice(0, 10),
          userPreferencesContext: getFormattedPromptContext()
        })
      });

      if (res.ok && res.data?.reply) {
        setCustomBriefing(res.data.reply);
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

      const targetDoc = selectedDocId !== 'ALL' ? documents.find(d => d.id === selectedDocId) : undefined;

      const res = await safeFetchJson<{ reply: string }>('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newChatHistory,
          contextDocs: documents.slice(0, 10),
          referenceDocs: refDocs.slice(0, 8),
          tasks: tasks.slice(0, 10),
          contextDocument: targetDoc,
          roleContext: selectedRole,
          learnedRules: learnedRules.slice(0, 15),
          trainingDatasets: trainingDatasets.slice(0, 10),
          userPreferencesContext: getFormattedPromptContext()
        })
      });

      setChatHistory(prev => [...prev, { role: 'assistant', content: res.data?.reply || res.error || 'Xin lỗi đồng chí, tôi chưa thể tổng hợp ngay lúc này.' }]);

      addInteractionRecord({
        promptSummary: queryText.slice(0, 120),
        selectedRole: preferences.preferredStyle,
        styleUsed: preferences.documentTone,
        legalBasisIncluded: preferences.includeLegalBasis,
        userFeedback: null
      });
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
      {/* Top Banner Header with Google Studio Flowing Gradient Border */}
      <div className="google-studio-border google-studio-glow">
        <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 p-6 rounded-[calc(1.25rem-2px)] text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg shadow-blue-500/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 text-amber-300 rounded-2xl border border-white/30 shadow-inner backdrop-blur-xs">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-white/20 text-white rounded-md border border-white/30 backdrop-blur-xs">
                  AI Advisory & Intelligence Center
                </span>
                <span className="text-[10px] font-bold text-emerald-200 flex items-center gap-1.5 bg-emerald-950/40 px-2.5 py-0.5 rounded-md border border-emerald-300/30 backdrop-blur-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                  Đồng bộ Kho Google Drive 100%
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide drop-shadow-xs">
                Trung tâm Trợ lý Tham mưu Cấp ủy
              </h1>
              <p className="text-xs text-blue-50 mt-0.5 font-medium">
                Hệ thống trí tuệ nhân tạo chuyên sâu hỗ trợ cán bộ tham mưu, bóc tách thẩm quyền và đôn đốc tiến độ dựa trên Kho Tri thức Google Drive
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <a
              href={DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2 transition-all cursor-pointer bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-xs"
              title="Mở thư mục tri thức Google Drive"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>Kho Google Drive</span>
            </a>

            <button
              onClick={toggleAudioSimulation}
              className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2 transition-all cursor-pointer ${
                isPlayingAudio ? 'bg-amber-400 text-slate-950 shadow-lg' : 'bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-xs'
              }`}
            >
              {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
              <span>{isPlayingAudio ? 'Dừng phát Audio' : 'Nghe tóm tắt Audio'}</span>
            </button>
          </div>
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
          onClick={() => setActiveTab('memory')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'memory' 
              ? 'bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 text-white shadow-md shadow-blue-500/30 scale-[1.02]' 
              : 'text-blue-900 bg-blue-50/80 hover:bg-blue-100/90 border border-blue-200/90'
          }`}
        >
          <Sliders className="w-4 h-4 text-cyan-300 animate-pulse" />
          <span>🧠 Bộ Nhớ & Tùy Chọn Định Dạng</span>
        </button>

        <button
          onClick={() => setActiveTab('finetune')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'finetune' 
              ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-md shadow-indigo-500/30 scale-[1.02]' 
              : 'text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100/90 border border-indigo-200/90'
          }`}
        >
          <Brain className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>🎓 Huấn Luyện Trợ Lý (Fine-Tuning Dataset)</span>
        </button>

        <button
          onClick={() => setActiveTab('training')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'training' 
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/30 scale-[1.02]' 
              : 'text-amber-800 bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/80'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300 animate-bounce" />
          <span>⭐ Luyện Não Tình Huống AI (Google Maps Review)</span>
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
          {/* Google Drive Knowledge Synchronization Banner */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50/70 to-sky-50 p-4 rounded-2xl border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-blue-950 uppercase tracking-wide">
                    Kho Tri thức & Quy chế Cấp ủy (Google Drive)
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md border border-emerald-300">
                    Folder ID: 1PYVbIAYivf3xrqxBc5YENp2C3kJwlqVR
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium">
                  AI tự động nạp Quy chế Đảng bộ, Thẩm quyền BTV vs UBND, Nghị định 30/2020, Quy định 66-QĐ/TW & Bộ mẫu bút phê từ Google Drive để trả lời chuẩn xác.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 bg-white text-slate-700 text-[10px] font-bold rounded border border-slate-200 shadow-3xs">
                    📁 Quy chế Ban Thường vụ & UBND
                  </span>
                  <span className="px-2 py-0.5 bg-white text-slate-700 text-[10px] font-bold rounded border border-slate-200 shadow-3xs">
                    ⚖️ NĐ 30/2020 & QĐ 66-QĐ/TW
                  </span>
                  <span className="px-2 py-0.5 bg-white text-slate-700 text-[10px] font-bold rounded border border-slate-200 shadow-3xs">
                    ✍️ Mẫu Bút phê Bí thư Đảng ủy
                  </span>
                  <span className="px-2 py-0.5 bg-white text-slate-700 text-[10px] font-bold rounded border border-slate-200 shadow-3xs">
                    🗂️ Ma trận Phân luồng & Hạn xử lý
                  </span>
                </div>
              </div>
            </div>

            <a
              href={DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all flex-shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>Mở Thư mục Drive</span>
            </a>
          </div>

          {/* Header & Tooling Controls */}
          <div className="border-b border-slate-100 pb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase">Hỏi đáp Tham mưu Chuyên sâu cùng Trợ lý AI</h2>
              <p className="text-xs text-slate-500">Tư vấn quy trình cấp ủy, phân định thẩm quyền BTV/UBND, dự thảo bút phê và giải đáp vướng mắc</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const text = chatHistory.map(m => `[${m.role === 'user' ? 'LÃNH ĐẠO / CÁN BỘ' : 'TRỢ LÝ AI THAM MƯU'}]\n${m.content}\n\n`).join('----------------------------------------\n\n');
                  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Trao-doi-Tham-muu-Chuyen-sau-${new Date().toISOString().slice(0, 10)}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Tải biên bản hội thoại"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất file MD</span>
              </button>

              <button
                onClick={() => {
                  setChatHistory([
                    {
                      role: 'assistant',
                      content: 'Kính chào đồng chí Cán bộ Lãnh đạo. Tôi đã làm mới phiên trao đổi và đồng bộ lại với Kho Tri thức Google Drive. Đồng chí cần tôi hỗ trợ tham mưu nội dung nào?'
                    }
                  ]);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Làm mới cuộc trò chuyện"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Role Mode & Scope Selection */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="md:col-span-7 flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Chế độ tham mưu:</span>
              <div className="flex gap-1.5">
                {[
                  { id: 'GENERAL', label: '🌟 Tổng hợp' },
                  { id: 'ROUTING_AUTHORITY', label: '🛡️ Thẩm quyền BTV / UBND' },
                  { id: 'DIRECTIVE_DRAFTING', label: '✍️ Bút phê Bí thư' },
                  { id: 'LEGAL_AUDIT', label: '⚖️ Thể thức & Pháp lý' }
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRole(r.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedRole === r.id
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-5 flex items-center gap-2 justify-end">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Phạm vi:</span>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full text-[11px] font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="ALL">Toàn bộ CSDL Cấp ủy + Google Drive</option>
                {documents.slice(0, 15).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.documentNumber ? `[${d.documentNumber}] ` : ''}{d.title?.slice(0, 45) || d.fileName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preset Queries grounded in Google Drive knowledge */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSendChat(undefined, "Theo Quy chế làm việc của Đảng bộ (trong Kho Google Drive), những nội dung văn bản nào bắt buộc phải trình Ban Thường vụ Đảng ủy cho chủ trương?")}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold border border-blue-200 transition-all cursor-pointer"
            >
              📁 Tra cứu Thẩm quyền Ban Thường vụ
            </button>
            <button
              onClick={() => handleSendChat(undefined, "Dự thảo mẫu Bút phê chỉ đạo sắc bén của Bí thư Đảng ủy đối với các văn bản đơn thư phản ánh của cử tri và trật tự đô thị.")}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-semibold border border-purple-200 transition-all cursor-pointer"
            >
              💡 Mẫu Bút phê Bí thư Đảng ủy
            </button>
            <button
              onClick={() => handleSendChat(undefined, "Tổng hợp danh sách các văn bản hỏa tốc và khẩn cấp chưa hoàn thành xử lý trong tuần này, đề xuất giải pháp đôn đốc.")}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-semibold border border-amber-200 transition-all cursor-pointer"
            >
              ⚡ Tổng hợp văn bản khẩn chưa hoàn thành
            </button>
            <button
              onClick={() => handleSendChat(undefined, "Rà soát thời hạn xử lý các văn bản và ma trận phân luồng nhiệm vụ theo quy chuẩn lưu trữ trên Google Drive.")}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-200 transition-all cursor-pointer"
            >
              📋 Ma trận phân luồng & Hạn xử lý
            </button>
          </div>

          {/* Chat Stream */}
          <div className="space-y-4 max-h-[560px] overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-200">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-700 text-amber-300 flex items-center justify-center flex-shrink-0 shadow-sm border border-blue-600">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-3xl p-4 rounded-2xl text-xs leading-relaxed font-medium relative group ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none shadow-sm' 
                    : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-2xs'
                }`}>
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="prose prose-xs max-w-none text-slate-800 space-y-2 leading-relaxed">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}

                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.content);
                        setCopiedIdx(idx);
                        setTimeout(() => setCopiedIdx(null), 2000);
                      }}
                      className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-700 p-1.5 bg-slate-100 hover:bg-blue-50 rounded-lg transition-all border border-slate-200 shadow-2xs cursor-pointer"
                      title="Sao chép câu trả lời"
                    >
                      {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex gap-3 items-center text-blue-600 text-xs font-bold py-2 bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Trợ lý AI đang đối chiếu Kho Tri thức Google Drive & CSDL Cấp ủy để soạn thảo tham mưu...</span>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={(e) => handleSendChat(e)} className="flex items-center gap-3">
            <input
              type="text"
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              placeholder="Nhập câu hỏi tham mưu, tra cứu quy chế hoặc yêu cầu dự thảo..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={isGenerating || !chatQuery.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Gửi tham mưu</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB: MEMORY & FORMATTING PREFERENCES */}
      {activeTab === 'memory' && (
        <InteractionMemoryPanel />
      )}

      {/* TAB: FINE-TUNING & ASSISTANT TRAINER STUDIO */}
      {activeTab === 'finetune' && (
        <AssistantTrainer />
      )}

      {/* TAB: DAILY SCENARIO TRAINING (GOOGLE MAPS REVIEW STYLE) */}
      {activeTab === 'training' && (
        <DailyScenarioTraining />
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
