import { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MessageSquare, X, Send, FileText, Sparkles, ShieldCheck, Scale, CheckCircle2, Copy, Check, RotateCcw, AlertCircle, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { Document } from '../types';

interface AIAssistantProps {
  isOpen?: boolean;
  onClose?: () => void;
  contextDocument?: any;
}

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

  useEffect(() => {
    async function loadReferenceDocs() {
      try {
        const snap = await getDocs(query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(50)));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
        const refDocs = docs.filter(d => 
          d.isReferenceDoc || 
          (d.tags || []).includes('TRA_CUU_THAM_KHAO') || 
          (d.tags || []).includes('Văn bản tra cứu') || 
          !!d.referenceCategory
        );
        setReferenceDocs(refDocs);
      } catch (e) {
        console.error('Error fetching reference docs for AIAssistant:', e);
      }
    }
    loadReferenceDocs();
  }, []);

  const initialWelcomeMessage = { 
    role: 'assistant' as const, 
    content: 'Kính chào đồng chí! Tôi là Trợ lý AI Tham mưu & Xử lý Văn bản Cấp ủy, Chính quyền (kết nối trực tiếp Kho Tri thức & Căn cứ Pháp lý số hóa). Tôi sẵn sàng hỗ trợ phân tích thẩm quyền phân luồng, bóc tách nhiệm vụ chỉ đạo, tra cứu quy định pháp luật và soạn thảo dự thảo văn bản.' 
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
          contextDocument,
          referenceDocs: referenceDocs.slice(0, 8),
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
          content: `Hệ thống AI đang gặp lỗi kết nối hoặc phản hồi chậm (${e?.message || 'Lỗi không xác định'}). Đồng chí vui lòng nhấn nút Gửi lại để thử lại.`,
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
          className="fixed inset-0 bg-blue-950/50 backdrop-blur-xs z-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white z-50 shadow-2xl border-l border-slate-200 flex flex-col transform-gpu will-change-transform transition-transform duration-250 ease-out font-sans",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-blue-700/60 flex items-center justify-between bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-inner border border-blue-300/30">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="text-sm font-black leading-tight flex items-center gap-2">
                Trợ lý Tham mưu Gemini
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold rounded-full">Trực tuyến</span>
              </div>
              <p className="text-[11px] text-blue-200/80">Tham mưu thẩm quyền & Thể thức văn bản</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleResetChat}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Làm mới cuộc trò chuyện"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Đóng trợ lý"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Current Document Context Bar (if available) */}
        {contextDocument && (
          <div className="px-4 py-2.5 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2 truncate">
              <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="font-bold truncate">{contextDocument.title || contextDocument.fileName || contextDocument.documentNumber}</span>
            </div>
            <span className="text-[10px] text-blue-700 uppercase font-black bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200 flex-shrink-0">Đang chọn</span>
          </div>
        )}

        {/* Message Conversation Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-3 items-start", msg.role === 'user' ? "flex-row-reverse" : "")}>
              {msg.role === 'assistant' && (
                <div className={cn(
                  "w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center shadow-xs border",
                  msg.isError ? "bg-red-50 text-red-600 border-red-200" : "bg-gradient-to-tr from-blue-900 to-indigo-900 text-amber-300 border-blue-800"
                )}>
                  {msg.isError ? <AlertCircle className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                </div>
              )}
              <div className={cn(
                "p-3.5 rounded-2xl text-xs leading-relaxed max-w-[85%] relative group shadow-xs",
                msg.role === 'user'
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-xs font-medium"
                  : msg.isError 
                    ? "bg-red-50 text-red-800 border border-red-200 rounded-tl-xs"
                    : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs"
              )}>
                <div className="whitespace-pre-wrap leading-relaxed space-y-1.5">{msg.content}</div>
                
                {msg.role === 'assistant' && !msg.isError && (
                  <button
                    onClick={() => handleCopy(msg.content, idx)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 p-1 bg-slate-100 hover:bg-slate-200 rounded transition-all"
                    title="Sao chép câu trả lời"
                  >
                    {copiedIdx === idx ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-900 to-indigo-900 flex-shrink-0 flex items-center justify-center shadow-xs border border-blue-800">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl text-xs bg-white text-slate-700 border border-slate-200/80 rounded-tl-xs flex items-center gap-2 shadow-xs">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: '300ms'}}></div>
                <span className="text-[11px] text-slate-500 font-medium ml-1">Gemini đang nghiên cứu văn bản & phân tích...</span>
              </div>
            </div>
          )}

          {/* Quick Suggestions Palette */}
          {messages.length <= 2 && (
            <div className="pt-2 space-y-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">Gợi ý tác nghiệp tham mưu</div>
              
              <button 
                onClick={() => handleSend("Hãy phân tích thẩm quyền xử lý và đề xuất phân luồng tham mưu (Báo cáo Thường vụ hay Chuyển UBND)?")} 
                className="w-full text-left p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-center justify-between group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-900">Phân luồng thẩm quyền (Ban Thường vụ / UBND)</span>
                </div>
              </button>

              <button 
                onClick={() => handleSend("Hãy trích xuất danh sách tất cả các nhiệm vụ cụ thể, cơ quan chủ trì và thời hạn hoàn thành.")} 
                className="w-full text-left p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-center justify-between group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-900">Bóc tách ma trận giao việc & mốc hạn hoàn thành</span>
                </div>
              </button>

              <button 
                onClick={() => handleSend("Soạn thảo nhanh dự thảo công văn chỉ đạo hoặc thông báo kết luận chuẩn thể thức Nghị định 30.")} 
                className="w-full text-left p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-center justify-between group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-900">Soạn dự thảo văn bản chỉ đạo / thông báo kết luận</span>
                </div>
              </button>

              <button 
                onClick={() => handleSend("Rà soát các căn cứ pháp lý và văn bản quy phạm pháp luật được viện dẫn.")} 
                className="w-full text-left p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-center justify-between group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Scale className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-900">Rà soát căn cứ pháp lý & viện dẫn</span>
                </div>
              </button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="Nhập yêu cầu tham mưu, hỏi đáp thể thức..." 
              className="w-full pl-3.5 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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
              className="absolute right-1.5 p-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-lg transition-colors shadow-xs"
              title="Gửi câu hỏi"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2 text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
            <span>Trợ lý AI Gemini hỗ trợ tham mưu theo quy chế Đảng & Nghị định 30/2020/NĐ-CP</span>
          </div>
        </div>
      </div>
    </>
  );
}
