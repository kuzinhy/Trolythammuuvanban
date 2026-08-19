import { useState, useEffect } from 'react';
import { Document } from '../types';
import { FileText, Sparkles, Copy, Check, X, Loader2, RefreshCw } from 'lucide-react';

interface DraftGeneratorProps {
  document: Document;
  onClose: () => void;
}

export default function DraftGenerator({ document, onClose }: DraftGeneratorProps) {
  const [draftType, setDraftType] = useState<string>(document.suggestedDraftType || 'Công văn chỉ đạo');
  const [draftContent, setDraftContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const draftTypes = [
    'Công văn chỉ đạo',
    'Thông báo kết luận',
    'Kế hoạch triển khai',
    'Tờ trình Ban Thường vụ',
    'Báo cáo giải trình / phúc đáp'
  ];

  const generateDraft = async (typeToGenerate: string = draftType) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/generate-response-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document,
          draftType: typeToGenerate
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Soạn thảo thất bại');
      }
      setDraftContent(data.draft || '');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi soạn thảo dự thảo');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateDraft(draftType);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(draftContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-none">Soạn Thảo Dự Thảo Văn Bản Chỉ Đạo / Kết Luận</h2>
              <p className="text-[11px] text-slate-300 mt-0.5">Tự động hóa theo thể thức Nghị định 30/2020/NĐ-CP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Control Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Loại văn bản:</span>
            <select
              value={draftType}
              onChange={(e) => {
                setDraftType(e.target.value);
                generateDraft(e.target.value);
              }}
              className="text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {draftTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={() => generateDraft(draftType)}
              disabled={isLoading}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Tạo lại dự thảo"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Tạo lại</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!draftContent || isLoading}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Đã sao chép vào bộ nhớ tạm' : 'Sao chép toàn bộ dự thảo'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-100/60">
          {isLoading ? (
            <div className="h-96 flex flex-col items-center justify-center text-slate-600 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              <p className="text-sm font-medium">Trợ lý AI đang lập dự thảo văn bản...</p>
              <p className="text-xs text-slate-400">Đang chuẩn hóa thể thức và nội dung phân công theo quy chế</p>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 max-w-3xl mx-auto font-serif">
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="w-full h-[520px] p-2 font-serif text-sm leading-relaxed text-slate-900 border-none resize-none focus:outline-none bg-transparent"
                placeholder="Nội dung dự thảo..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
