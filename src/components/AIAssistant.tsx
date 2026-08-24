import { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getActiveLearningRules, LearningRule } from '../lib/learningEngine';
import { 
  X, Send, FileText, Sparkles, ShieldCheck, Scale, CheckCircle2, 
  Copy, Check, RotateCcw, AlertCircle, Download, 
  ChevronDown, Layers, PenTool, Database, MessageSquareQuote, Brain
} from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { Document } from '../types';

interface AIAssistantProps {
  isOpen?: boolean;
  onClose?: () => void;
  contextDocument?: any;
}

type AdvisorRole = 'CHIEF_OF_STAFF' | 'ROUTING_AUTHORITY' | 'DIRECTIVE_DRAFTING' | 'LEGAL_AUDIT';

const ROLES: { id: AdvisorRole; label: string; icon: any; description: string }[] = [
  { 
    id: 'CHIEF_OF_STAFF', 
    label: 'Trợ lý Chánh VP', 
    icon: Sparkles,
    description: 'Tham mưu tổng hợp, điểm nóng điều hành & phân bổ công việc'
  },
  { 
    id: 'ROUTING_AUTHORITY', 
    label: 'Phân luồng Thẩm quyền', 
    icon: ShieldCheck,
    description: 'Đối chiếu Quy chế Đảng & Quyết định phân công Cấp ủy'
  },
  { 
    id: 'DIRECTIVE_DRAFTING', 
    label: 'Dự thảo & Bút phê', 
    icon: PenTool,
    description: 'Soạn thông báo kết luận, công văn & mẫu bút phê Bí thư'
  },
  { 
    id: 'LEGAL_AUDIT', 
    label: 'Thể thức & Pháp lý', 
    icon: Scale,
    description: 'Rà soát Nghị định 30/2020/NĐ-CP & Quy định 66-QĐ/TW'
  }
];

export default function AIAssistant({ isOpen: controlledIsOpen, onClose, contextDocument }: AIAssistantProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (val: boolean) => {
    if (onClose && !val) {
      onClose();
    }
    setInternalIsOpen(val);
  };

  const [referenceDocs, setReferenceDocs] = useState<Document[]>([]);
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [learnedRules, setLearnedRules] = useState<LearningRule[]>([]);
  const [trainingDatasets, setTrainingDatasets] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(contextDocument?.id || 'ALL');
  const [selectedRole, setSelectedRole] = useState<AdvisorRole>('CHIEF_OF_STAFF');
  const [showDocSelector, setShowDocSelector] = useState(false);

  useEffect(() => {
    if (contextDocument?.id) {
      setSelectedDocId(contextDocument.id);
    }
  }, [contextDocument]);

  useEffect(() => {
    async function loadDocsAndBrain() {
      try {
        const snap = await getDocs(query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(50)));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
        setRecentDocs(docs);

        const refDocs = docs.filter(d => 
          d.isReferenceDoc || 
          (d.tags || []).includes('TRA_CUU_THAM_KHAO') || 
          (d.tags || []).includes('Văn bản tra cứu') || 
          !!d.referenceCategory
        );
        setReferenceDocs(refDocs);

        // Load active learned rules & fine-tuning golden pairs for AI Brain
        const rules = await getActiveLearningRules();
        setLearnedRules(rules);

        const dsSnap = await getDocs(query(collection(db, 'ai_training_datasets'), orderBy('createdAt', 'desc'), limit(20)));
        if (!dsSnap.empty) {
          const dsData = dsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTrainingDatasets(dsData);
        }
      } catch (e) {
        console.error('Error fetching docs and learning brain for AIAssistant:', e);
      }
    }
    loadDocsAndBrain();
  }, []);

  const activeDocument = selectedDocId === 'ALL' 
    ? (contextDocument || null) 
    : (recentDocs.find(d => d.id === selectedDocId) || contextDocument || null);

  const initialWelcomeMessage = { 
    role: 'assistant' as const, 
    content: `**Kính chào đồng chí!** Tôi là **Trợ lý AI Tham mưu & Xử lý Văn bản Cấp ủy** (kết nối trực tiếp Kho Tri thức & Căn cứ Pháp lý số hóa).\n\nTôi sẵn sàng hỗ trợ đồng chí:\n- 🎯 **Phân tích thẩm quyền phân luồng** (Ban Thường vụ Đảng ủy / UBND phường).\n- 📋 **Bóc tách ma trận nhiệm vụ** và thời hạn hoàn thành.\n- ✍️ **Dự thảo ý kiến kết luận, thông báo, bút phê mẫu** cho Thường trực.\n- ⚖️ **Rà soát căn cứ pháp lý & thể thức hành chính** chuẩn Nghị định 30/2020/NĐ-CP.\n\n*Đồng chí có thể chọn nhanh gợi ý bên dưới hoặc nhập yêu cầu trực tiếp:*` 
  };

  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string; isError?: boolean }[]>([
    initialWelcomeMessage
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleResetChat = () => {
    setMessages([initialWelcomeMessage]);
    setInput('');
  };

  const handleExportChat = () => {
    const text = messages.map(m => `[${m.role === 'user' ? 'LÃNH ĐẠO / CÁN BỘ' : 'TRỢ LÝ AI THAM MƯU'}]\n${m.content}\n\n`).join('----------------------------------------\n\n');
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trao-doi-Tham-muu-AI-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;
    
    const userMessage = trimmed;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setIsThinking(true);

    try {
      const apiMessages = newMessages
        .filter(m => !m.isError)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: apiMessages,
          contextDocument: activeDocument,
          roleContext: selectedRole,
          referenceDocs: referenceDocs.slice(0, 10),
          contextDocs: recentDocs.slice(0, 10),
          learnedRules: learnedRules.slice(0, 15),
          trainingDatasets: trainingDatasets.slice(0, 10),
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi xử lý phản hồi từ AI');
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Tôi đã tiếp nhận yêu cầu.' }]);
    } catch (e: any) {
      console.error('AIAssistant send error:', e);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: `⚠️ **Hệ thống AI đang gặp lỗi kết nối hoặc phản hồi chậm** (${e?.message || 'Lỗi không xác định'}).\n\nĐồng chí vui lòng kiểm tra kết nối và nhấn nút Gửi lại để thử lại.`,
          isError: true 
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <>
      {/* Slide-over Drawer Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-blue-950/40 backdrop-blur-xs z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[540px] md:w-[580px] bg-white z-50 shadow-2xl border-l border-slate-200 flex flex-col transform-gpu will-change-transform transition-transform duration-250 ease-out font-sans",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer Header with Luminous Royal Sapphire Blue Gradient */}
        <div className="px-5 py-4 border-b border-blue-600/30 flex items-center justify-between bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-xs border border-white/30 backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-black leading-tight flex items-center gap-2 drop-shadow-xs">
                <span>Hỏi AI Tham Mưu Cấp Ủy</span>
                <span className="px-2 py-0.5 bg-emerald-400/25 text-emerald-200 border border-emerald-300/40 text-[9px] font-black rounded-full backdrop-blur-xs">
                  Gemini 2.5 Live
                </span>
              </div>
              <p className="text-[11px] text-blue-50 font-medium">Trợ lý Chiến lược & Xử lý Văn bản Đảng - Chính quyền</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={handleExportChat}
              className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              title="Xuất biên bản trao đổi ra tệp Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
            <button 
              onClick={handleResetChat}
              className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              title="Làm mới cuộc trò chuyện"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              title="Đóng trợ lý"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Role & Context Selector Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Role Mode Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const isActive = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
                  )}
                  title={role.description}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-amber-300" : "text-slate-500")} />
                  <span>{role.label}</span>
                </button>
              );
            })}
          </div>

          {/* Document Scope Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowDocSelector(!showDocSelector)}
              className="px-2.5 py-1 bg-white border border-slate-200 hover:border-blue-300 text-blue-900 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span className="max-w-[140px] truncate">
                {activeDocument ? (activeDocument.documentNumber || activeDocument.title || activeDocument.fileName) : 'Toàn bộ CSDL Cấp ủy'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showDocSelector && (
              <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-1.5 max-h-60 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase">Chọn phạm vi ngữ cảnh</div>
                <button
                  onClick={() => {
                    setSelectedDocId('ALL');
                    setShowDocSelector(false);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors",
                    selectedDocId === 'ALL' ? "bg-blue-50 text-blue-800 font-bold" : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>Toàn bộ CSDL Văn bản & Kho Tra cứu</span>
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase">Văn bản đến gần đây</div>
                {recentDocs.slice(0, 8).map(d => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelectedDocId(d.id);
                      setShowDocSelector(false);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors truncate",
                      selectedDocId === d.id ? "bg-blue-50 text-blue-800 font-bold" : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{d.documentNumber ? `[${d.documentNumber}] ` : ''}{d.title || d.fileName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message Conversation Stream */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/70">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-3 items-start", msg.role === 'user' ? "flex-row-reverse" : "")}>
              {msg.role === 'assistant' && (
                <div className={cn(
                  "w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-xs border",
                  msg.isError ? "bg-red-50 text-red-600 border-red-200" : "bg-gradient-to-tr from-blue-700 to-indigo-700 text-amber-300 border-blue-600"
                )}>
                  {msg.isError ? <AlertCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>
              )}

              <div className={cn(
                "p-4 rounded-2xl text-xs leading-relaxed max-w-[88%] relative group shadow-xs",
                msg.role === 'user'
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-xs font-medium"
                  : msg.isError 
                    ? "bg-red-50 text-red-800 border border-red-200 rounded-tl-xs"
                    : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-2xs"
              )}>
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                ) : (
                  <div className="prose prose-xs max-w-none text-slate-800 space-y-2 leading-relaxed">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                )}
                
                {msg.role === 'assistant' && !msg.isError && (
                  <button
                    onClick={() => handleCopy(msg.content, idx)}
                    className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-700 p-1.5 bg-slate-100 hover:bg-blue-50 rounded-lg transition-all border border-slate-200 shadow-2xs cursor-pointer"
                    title="Sao chép câu trả lời"
                  >
                    {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-700 flex-shrink-0 flex items-center justify-center shadow-xs border border-blue-600">
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              </div>
              <div className="p-4 rounded-2xl text-xs bg-white text-slate-700 border border-slate-200 rounded-tl-xs flex items-center gap-2.5 shadow-2xs">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{animationDelay: '300ms'}}></div>
                <span className="text-xs text-slate-600 font-semibold ml-1">Trợ lý AI đang tra cứu CSDL & soạn thảo tham mưu...</span>
              </div>
            </div>
          )}

          {/* Quick Suggestions Palette */}
          {messages.length <= 2 && (
            <div className="pt-2 space-y-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                Gợi ý tác nghiệp tham mưu nhanh ({ROLES.find(r => r.id === selectedRole)?.label})
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button 
                  onClick={() => handleSend("Hãy phân tích thẩm quyền xử lý văn bản này và đề xuất phương án phân luồng (Báo cáo Thường vụ Đảng ủy hay Chuyển UBND phường chủ trì)?")} 
                  className="text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-2.5 group shadow-2xs cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-blue-900">Phân luồng Thẩm quyền</div>
                    <div className="text-[10px] text-slate-500">Ban Thường vụ / UBND</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleSend("Hãy bóc tách danh sách tất cả các nhiệm vụ cụ thể, đơn vị chủ trì, phối hợp và thời hạn hoàn thành.")} 
                  className="text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-2.5 group shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-blue-900">Bóc tách Nhiệm vụ</div>
                    <div className="text-[10px] text-slate-500">Ma trận giao việc & hạn định</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleSend("Đề xuất mẫu bút phê chỉ đạo sắc sảo, đanh thép dành cho Bí thư Đảng ủy chỉ đạo các đơn vị.")} 
                  className="text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-2.5 group shadow-2xs cursor-pointer"
                >
                  <MessageSquareQuote className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-blue-900">Mẫu Bút phê Bí thư</div>
                    <div className="text-[10px] text-slate-500">Ý kiến chỉ đạo cô đọng</div>
                  </div>
                </button>

                <button 
                  onClick={() => handleSend("Rà soát các căn cứ pháp lý, thể thức văn bản theo Nghị định 30/2020/NĐ-CP và Quy định 66-QĐ/TW.")} 
                  className="text-left p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-start gap-2.5 group shadow-2xs cursor-pointer"
                >
                  <Scale className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 group-hover:text-blue-900">Rà soát Căn cứ Pháp lý</div>
                    <div className="text-[10px] text-slate-500">Kiểm tra viện dẫn quy phạm</div>
                  </div>
                </button>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="relative flex items-center">
            <textarea 
              rows={2}
              placeholder="Nhập câu hỏi tham mưu, yêu cầu dự thảo văn bản hoặc bóc tách số liệu..." 
              className="w-full pl-3.5 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none leading-relaxed"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button 
              onClick={() => handleSend()} 
              disabled={!input.trim() || isThinking}
              className="absolute right-2.5 p-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-30 text-white rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
              title="Gửi câu hỏi tham mưu (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>Nhấn <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">Enter</kbd> để gửi, <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">Shift+Enter</kbd> để xuống dòng</span>
            <span className="text-blue-600 font-bold">Quy chế Đảng & NĐ 30/2020/NĐ-CP</span>
          </div>
        </div>
      </div>
    </>
  );
}

