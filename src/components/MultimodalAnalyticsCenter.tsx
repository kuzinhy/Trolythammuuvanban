import React, { useState } from 'react';
import { FileUp, Eye, Sparkles, CheckCircle2, AlertTriangle, FileText, Download, RefreshCw, Cpu, Layers, ArrowRight, ShieldCheck, CheckSquare, Clock } from 'lucide-react';

interface TaskExtracted {
  taskName: string;
  assignedTo: string;
  deadline: string;
  priority: string;
}

interface MultimodalResult {
  extractedTitle: string;
  mediaTypeDetected: string;
  fullExtractedText: string;
  keyConclusions: string[];
  extractedTasks: TaskExtracted[];
  advisoryNotes: string;
}

export function MultimodalAnalyticsCenter() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MultimodalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setError(null);
      if (selected.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Vui lòng chọn hoặc kéo thả tệp hình ảnh/sơ đồ/ghi chép cuộc họp');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/analyze-multimodal-file', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Lỗi khi phân tích tệp đa phương thức');
      }

      const data: MultimodalResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Không thể phân tích tệp đa phương thức.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 text-white rounded-2xl shadow-md">
            <Eye className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <span>Báo Cáo Tham Mưu Đa Phương Thức (Multimodal Sight AI)</span>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-full border border-indigo-200">
                OCR & Diagram
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Trích xuất tự động chỉ đạo, bảng biểu, sơ đồ thực địa, và ghi chép tay từ hình ảnh / PDF cuộc họp
            </p>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-3xl p-6 text-center transition-all cursor-pointer relative group">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-4 bg-white rounded-2xl shadow-sm text-indigo-600 group-hover:scale-110 transition-transform">
                <FileUp className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {file ? file.name : 'Nhấp hoặc kéo thả hình ảnh / Sổ tay họp / Sơ đồ'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Hỗ trợ PNG, JPG, JPEG, PDF (Ảnh chụp bảng họp, sơ đồ dự án, sổ tay)
                </p>
              </div>
            </div>
          </div>

          {previewUrl && (
            <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 relative group overflow-hidden">
              <img src={previewUrl} alt="File Preview" className="max-h-48 w-full object-contain rounded-xl" />
              <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-lg">
                Xem trước ảnh nguồn
              </div>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !file}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-800 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
            <span>{loading ? 'AI đang bóc tách hình ảnh & dữ liệu...' : 'Phân Tích Đa Phương Thức (Multimodal Sight AI)'}</span>
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7">
          {result ? (
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-indigo-600 text-white font-black text-[10px] rounded-lg uppercase">
                    {result.mediaTypeDetected}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 line-clamp-1">{result.extractedTitle}</h4>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Hoàn tất AI Sight</span>
                </div>
              </div>

              {/* Advisory Notes */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-4 rounded-2xl shadow-sm space-y-1">
                <p className="text-[11px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>Khuyến Nghị Tham Mưu Dành Cho Chánh VP:</span>
                </p>
                <p className="text-xs text-blue-100 leading-relaxed font-medium">{result.advisoryNotes}</p>
              </div>

              {/* Key Conclusions */}
              {result.keyConclusions.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                    <span>Kết Luận & Chỉ Đạo Trích Xuất Cốt Lõi:</span>
                  </h5>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {result.keyConclusions.map((item, idx) => (
                      <li key={idx} className="p-2.5 bg-white border border-slate-200/80 rounded-xl flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Extracted Tasks */}
              {result.extractedTasks.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Nhiệm Vụ Cụ Thể Phân Công Đơn Vị:</span>
                  </h5>
                  <div className="space-y-2">
                    {result.extractedTasks.map((t, i) => (
                      <div key={i} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-black text-slate-900">{t.taskName}</p>
                          <p className="text-[11px] text-slate-500">
                            Đơn vị: <span className="font-bold text-slate-700">{t.assignedTo}</span> | Hạn: <span className="font-bold text-blue-700">{t.deadline}</span>
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          t.priority === 'CAO' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {t.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full OCR Text Accordion */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Toàn văn bản ghi nhận (OCR Full Text):</p>
                <div className="p-3 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                  {result.fullExtractedText}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
              <div className="p-4 bg-white rounded-2xl w-fit mx-auto text-slate-400 shadow-xs">
                <Eye className="w-8 h-8" />
              </div>
              <p className="text-xs font-bold text-slate-600">
                Chưa phân tích tệp đa phương thức
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Tải lên ảnh chụp sơ đồ, ghi chép cuộc họp hoặc tài liệu đính kèm bên trái để AI tự động trích xuất kết luận và nhiệm vụ.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
