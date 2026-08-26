import { useState, useEffect } from 'react';
import { Calendar, Sparkles, Printer, Download, Plus, Clock, Building2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router';
import WorkScheduleWidget from '../components/WorkScheduleWidget';

export default function Schedule() {
  const navigate = useNavigate();

  const handlePrintSchedule = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Banner & Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/30 text-blue-200 border border-blue-400/30 text-xs font-bold rounded-full backdrop-blur-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Lịch Công Tác Lãnh Đạo & Cơ Quan
              </span>
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-full">
                Tuần 35 / 2026
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Lịch Công Tác Trong Tuần
            </h1>
            
            <p className="text-sm text-slate-300 leading-relaxed">
              Quản lý, theo dõi và đồng bộ các cuộc họp Thường trực Đảng ủy, HĐND, UBND, hội nghị giao ban và lịch làm việc của lãnh đạo cơ quan.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => navigate('/ai-assistant')}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-100" />
              <span>Tạo Lịch AI</span>
            </button>
            
            <button
              onClick={handlePrintSchedule}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-2xl border border-white/20 backdrop-blur-xs transition-all flex items-center gap-2 cursor-pointer"
              title="In Lịch Công Tác Tuần"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>In Lịch Tuần</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Schedule Widget Component */}
      <WorkScheduleWidget />
    </div>
  );
}
