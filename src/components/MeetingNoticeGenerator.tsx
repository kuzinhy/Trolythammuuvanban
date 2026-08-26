import { useState } from 'react';
import { FileText, Sparkles, Copy, Check, Printer, RefreshCw, AlertCircle, Calendar, Users, Building2, CheckSquare } from 'lucide-react';
import { safeFetchJson } from '../lib/safeFetch';

interface DirectiveItem {
  topic: string;
  assessment: string;
  directiveContent: string;
  leadUnit: string;
  coordinatingUnits: string[];
  completionDeadline: string;
}

interface NoticeData {
  documentNumber: string;
  title: string;
  meetingOverview: string;
  conclusionsAndDirectives: DirectiveItem[];
  organizationAndMonitoring: string;
  fullFormattedDocument: string;
}

export function MeetingNoticeGenerator() {
  const [meetingTitle, setMeetingTitle] = useState('Cuộc họp Giao ban Thường trực Đảng ủy Phường tháng 08/2026');
  const [chairPerson, setChairPerson] = useState('Đồng chí Bí thư Đảng ủy Phường');
  const [meetingDate, setMeetingDate] = useState('22/08/2026');
  const [keyTopics, setKeyTopics] = useState('Đánh giá công tác quản lý trật tự đô thị, kết quả số hóa thủ tục hành chính tại Bộ phận 1 cửa và kiểm tra an toàn PCCC khu phố.');
  const [directivesText, setDirectivesText] = useState('Giao UBND phường xử lý dứt điểm chợ tự phát trước 30/08; Giao Khối Dân vận vận động 100% hộ dân trang bị bình chữa cháy trước 15/09; Giao Văn phòng đôn đốc lịch trực tiếp công dân.');

  const [loading, setLoading] = useState(false);
  const [noticeData, setNoticeData] = useState<NoticeData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const directivesArray = directivesText.split(';').map(s => s.trim()).filter(Boolean);

      const res = await safeFetchJson<NoticeData>('/api/generate-meeting-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingTitle,
          chairPerson,
          meetingDate,
          keyTopics,
          directives: directivesArray
        })
      });

      if (!res.ok || !res.data) {
        throw new Error(res.error || 'Lỗi khi dự thảo thông báo kết luận');
      }

      setNoticeData(res.data);
    } catch (err: any) {
      setError(err.message || 'Không thể tạo thông báo kết luận.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!noticeData) return;
    navigator.clipboard.writeText(noticeData.fullFormattedDocument || noticeData.title);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
              Dự Thảo Thông Báo Kết Luận Họp (Chuẩn Hướng dẫn 05-HD/VPTW)
            </h3>
            <p className="text-xs text-slate-500">
              Tự động cụ thể hóa kết luận Thường trực/Ban Thường vụ Đảng ủy thành Thông báo kết luận phân công nhiệm vụ
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
          <span>{loading ? 'AI đang soạn thảo...' : 'Dự Thảo Thông Báo AI'}</span>
        </button>
      </div>

      {/* Form inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Tên cuộc họp:</label>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            className="w-full text-xs px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Chủ trì cuộc họp:</label>
          <input
            type="text"
            value={chairPerson}
            onChange={(e) => setChairPerson(e.target.value)}
            className="w-full text-xs px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian tổ chức:</label>
          <input
            type="text"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="w-full text-xs px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung trọng tâm & Kết luận chỉ đạo của Lãnh đạo (Cách nhau bởi dấu chấm phẩy ;):</label>
          <textarea
            rows={2}
            value={directivesText}
            onChange={(e) => setDirectivesText(e.target.value)}
            className="w-full text-xs p-3 bg-white border border-slate-300 rounded-xl text-slate-800"
            placeholder="Giao UBND phường...; Giao Khối Dân vận...; Giao Văn phòng đôn đốc..."
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generated Document View */}
      {noticeData && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Dự thảo Thông báo Kết luận hoàn chỉnh</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép văn bản'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Văn Bản</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-3xl p-8 bg-white shadow-xs space-y-6">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold text-slate-900 uppercase">ĐẢNG UỶ PHƯỜNG TÂN AN</p>
                <p className="text-xs font-black text-blue-900 uppercase">VĂN PHÒNG ĐẢNG UỶ</p>
                <p className="text-[11px] text-slate-500 mt-1">Số: {noticeData.documentNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900 uppercase">ĐẢNG CỘNG SẢN VIỆT NAM</p>
                <p className="text-xs text-slate-500 italic mt-1">Tân An, ngày {meetingDate}</p>
              </div>
            </div>

            <div className="text-center space-y-2 py-2">
              <h2 className="text-base font-black text-slate-900 uppercase">THÔNG BÁO KẾT LUẬN</h2>
              <p className="text-xs font-bold text-slate-700 max-w-xl mx-auto">{noticeData.title}</p>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed italic bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              {noticeData.meetingOverview}
            </p>

            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">
                Ý KIẾN KẾT LUẬN & CHỈ ĐẠO CỦA THƯỜNG TRỰC ĐẢNG UỶ:
              </h4>

              <div className="space-y-3">
                {noticeData.conclusionsAndDirectives.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-blue-900 uppercase">{idx + 1}. {item.topic}</span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-md">
                        Hạn: {item.completionDeadline}
                      </span>
                    </div>

                    <p className="text-slate-600 italic">Đánh giá: {item.assessment}</p>
                    <p className="font-bold text-slate-900 bg-white p-2.5 rounded-xl border border-slate-200">
                      Chỉ đạo: {item.directiveContent}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-600 pt-1">
                      <span>Đơn vị chủ trì: <strong className="text-slate-900">{item.leadUnit}</strong></span>
                      <span>Đơn vị phối hợp: <strong className="text-slate-800">{item.coordinatingUnits.join(', ')}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 text-xs text-slate-700 space-y-2">
              <p className="font-bold text-slate-900">TỔ CHỨC THỰC HIỆN & ĐÔN ĐỐC:</p>
              <p className="leading-relaxed">{noticeData.organizationAndMonitoring}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
