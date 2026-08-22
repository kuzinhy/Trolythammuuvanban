import { useState } from 'react';
import { Calendar, Sparkles, Printer, Copy, Check, Clock, MapPin, Users, Building2, RefreshCw, AlertCircle, FileText, Download } from 'lucide-react';
import { Document, Task } from '../types';

interface EventItem {
  time: string;
  content: string;
  chairPerson: string;
  attendees: string;
  location: string;
  preparingUnit: string;
}

interface DaySchedule {
  dayOfWeek: string;
  date: string;
  morningEvents: EventItem[];
  afternoonEvents: EventItem[];
}

interface WeeklyScheduleData {
  weekTitle: string;
  generalDirectivesSummary: string;
  days: DaySchedule[];
  keyNotes: string[];
}

interface WeeklyScheduleGeneratorProps {
  documents?: Document[];
  tasks?: Task[];
}

export function WeeklyScheduleGenerator({ documents = [], tasks = [] }: WeeklyScheduleGeneratorProps) {
  const [weekTitle, setWeekTitle] = useState('Tuần 35/2026 (Từ 24/08 đến 30/08/2026)');
  const [extraNotes, setExtraNotes] = useState('Tập trung công tác giao ban Thường trực, rà soát PCCC khu phố, kiểm tra thủ tục 1 cửa UBND phường.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduleData, setScheduleData] = useState<WeeklyScheduleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-weekly-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekTitle,
          notes: extraNotes,
          documents,
          tasks
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Lỗi khi kết nối với máy chủ AI');
      }

      const data: WeeklyScheduleData = await res.json();
      setScheduleData(data);
    } catch (err: any) {
      setError(err.message || 'Không thể khởi tạo Lịch công tác tuần.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = () => {
    if (!scheduleData) return;
    let text = `LỊCH CÔNG TÁC TUẦN THƯỜNG TRỰC ĐẢNG UỶ PHƯỜNG\n${scheduleData.weekTitle.toUpperCase()}\n\n`;
    text += `ĐỊNH HƯỚNG TRỌNG TÂM: ${scheduleData.generalDirectivesSummary}\n\n`;

    scheduleData.days.forEach(day => {
      text += `=== ${day.dayOfWeek.toUpperCase()} (${day.date}) ===\n`;
      text += `* BUỔI SÁNG:\n`;
      if (day.morningEvents.length === 0) {
        text += `  - Trực làm việc thường quy tại cơ quan.\n`;
      } else {
        day.morningEvents.forEach(ev => {
          text += `  [${ev.time}] ${ev.content}\n    + Chủ trì: ${ev.chairPerson} | TP: ${ev.attendees}\n    + Đ.Điểm: ${ev.location} | ĐV chuẩn bị: ${ev.preparingUnit}\n`;
        });
      }
      text += `* BUỔI CHIỀU:\n`;
      if (day.afternoonEvents.length === 0) {
        text += `  - Trực làm việc thường quy tại cơ quan.\n`;
      } else {
        day.afternoonEvents.forEach(ev => {
          text += `  [${ev.time}] ${ev.content}\n    + Chủ trì: ${ev.chairPerson} | TP: ${ev.attendees}\n    + Đ.Điểm: ${ev.location} | ĐV chuẩn bị: ${ev.preparingUnit}\n`;
        });
      }
      text += `\n`;
    });

    text += `GHI CHÚ CHUẨN BỊ & TRỰC CƠ QUAN:\n`;
    scheduleData.keyNotes.forEach((n, i) => {
      text += `${i + 1}. ${n}\n`;
    });

    navigator.clipboard.writeText(text);
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
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
              Tự Động Lập Lịch Công Tác Tuần (AI Schedule)
            </h3>
            <p className="text-xs text-slate-500">
              Tổng hợp tự động văn bản đến, chỉ đạo Thường trực & nhiệm vụ đôn đốc thành Lịch công tác tuần chuẩn mực
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
          <span>{isGenerating ? 'AI Đang lập lịch...' : 'Lập Lịch Công Tác Tuần AI'}</span>
        </button>
      </div>

      {/* Input Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian Tuần làm việc:</label>
          <input
            type="text"
            value={weekTitle}
            onChange={(e) => setWeekTitle(e.target.value)}
            className="w-full text-xs px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
            placeholder="Ví dụ: Tuần 35/2026 (Từ 24/08 đến 30/08/2026)"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú Chỉ đạo Trọng tâm của Lãnh đạo:</label>
          <input
            type="text"
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            className="w-full text-xs px-3.5 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-800"
            placeholder="Ghi chú thêm nội dung cuộc họp hoặc công tác kiểm tra..."
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Schedule Output */}
      {scheduleData && (
        <div className="space-y-6 animate-fade-in print:p-0">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-2xl shadow-sm print:hidden">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-200">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Đã tổng hợp Lịch công tác tuần chính thức</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép văn bản'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Lịch Công Tác</span>
              </button>
            </div>
          </div>

          {/* Schedule Sheet Document */}
          <div className="border border-slate-200 rounded-3xl p-6 md:p-8 bg-white shadow-xs space-y-6">
            {/* Header Document Standard */}
            <div className="flex flex-col md:flex-row justify-between items-start border-b border-slate-200 pb-6 gap-4">
              <div className="text-center md:text-left">
                <p className="text-xs font-bold text-slate-800 uppercase">ĐẢNG UỶ PHƯỜNG TÂN AN</p>
                <p className="text-xs font-black text-blue-900 uppercase">VĂN PHÒNG ĐẢNG UỶ</p>
                <p className="text-[11px] text-slate-500 italic mt-0.5">Số: ... -LCT/VPTU</p>
              </div>
              <div className="text-center md:text-right w-full md:w-auto">
                <p className="text-xs font-bold text-slate-800 uppercase">ĐẢNG CỘNG SẢN VIỆT NAM</p>
                <p className="text-xs text-slate-500 italic mt-0.5">Tân An, ngày ... tháng ... năm 2026</p>
              </div>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">LỊCH CÔNG TÁC TUẦN</h2>
              <p className="text-xs font-bold text-blue-700">{scheduleData.weekTitle}</p>
              <p className="text-xs text-slate-600 max-w-2xl mx-auto italic pt-1">
                "{scheduleData.generalDirectivesSummary}"
              </p>
            </div>

            {/* Timetable Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-2xl">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold text-center">
                    <th className="p-3 border border-slate-700 w-28">Thứ / Ngày</th>
                    <th className="p-3 border border-slate-700 w-20">Buổi</th>
                    <th className="p-3 border border-slate-700 w-24">Giờ</th>
                    <th className="p-3 border border-slate-700">Nội dung công việc</th>
                    <th className="p-3 border border-slate-700 w-36">Chủ trì</th>
                    <th className="p-3 border border-slate-700 w-44">Thành phần</th>
                    <th className="p-3 border border-slate-700 w-32">Địa điểm</th>
                    <th className="p-3 border border-slate-700 w-32">Đơn vị chuẩn bị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {scheduleData.days.map((day, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 border border-slate-200 font-black text-slate-900 bg-slate-50 text-center align-middle">
                        <div className="text-xs font-black text-blue-900">{day.dayOfWeek}</div>
                        <div className="text-[11px] font-bold text-slate-500">{day.date}</div>
                      </td>

                      <td colSpan={7} className="p-0 border border-slate-200">
                        <table className="w-full text-xs">
                          <tbody>
                            {/* Morning */}
                            <tr className="border-b border-slate-200">
                              <td className="p-2.5 font-bold text-amber-700 bg-amber-50/50 text-center w-20 align-top border-r border-slate-200">
                                SÁNG
                              </td>
                              <td className="p-0">
                                {day.morningEvents.length === 0 ? (
                                  <div className="p-2.5 text-slate-400 italic">Trực làm việc giải quyết công việc thường quy tại cơ quan.</div>
                                ) : (
                                  <div className="divide-y divide-slate-100">
                                    {day.morningEvents.map((ev, i) => (
                                      <div key={i} className="grid grid-cols-12 p-2.5 items-start gap-2">
                                        <div className="col-span-2 font-bold text-slate-900 text-center">{ev.time}</div>
                                        <div className="col-span-4 font-semibold text-slate-900">{ev.content}</div>
                                        <div className="col-span-2 text-slate-700 font-medium">{ev.chairPerson}</div>
                                        <div className="col-span-2 text-slate-600 text-[11px]">{ev.attendees}</div>
                                        <div className="col-span-1 text-slate-700 font-medium">{ev.location}</div>
                                        <div className="col-span-1 text-slate-500 text-[11px] italic">{ev.preparingUnit}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>

                            {/* Afternoon */}
                            <tr>
                              <td className="p-2.5 font-bold text-blue-700 bg-blue-50/50 text-center w-20 align-top border-r border-slate-200">
                                CHIỀU
                              </td>
                              <td className="p-0">
                                {day.afternoonEvents.length === 0 ? (
                                  <div className="p-2.5 text-slate-400 italic">Trực làm việc giải quyết công việc thường quy tại cơ quan.</div>
                                ) : (
                                  <div className="divide-y divide-slate-100">
                                    {day.afternoonEvents.map((ev, i) => (
                                      <div key={i} className="grid grid-cols-12 p-2.5 items-start gap-2">
                                        <div className="col-span-2 font-bold text-slate-900 text-center">{ev.time}</div>
                                        <div className="col-span-4 font-semibold text-slate-900">{ev.content}</div>
                                        <div className="col-span-2 text-slate-700 font-medium">{ev.chairPerson}</div>
                                        <div className="col-span-2 text-slate-600 text-[11px]">{ev.attendees}</div>
                                        <div className="col-span-1 text-slate-700 font-medium">{ev.location}</div>
                                        <div className="col-span-1 text-slate-500 text-[11px] italic">{ev.preparingUnit}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Key Notes */}
            {scheduleData.keyNotes.length > 0 && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs">
                <h4 className="font-bold text-amber-900 uppercase flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Ghi Chú Công Tác Trực & Chuẩn Bị Tài Liệu:</span>
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-amber-900">
                  {scheduleData.keyNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
