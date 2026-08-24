import { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { 
  CheckCircle2, Clock, AlertTriangle, BarChart3, PieChart as PieIcon, 
  Building2, ChevronRight, Sparkles, Filter, TrendingUp, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { Document, Task } from '../types';
import { getDocumentProgressStatus, parseDateString } from '../lib/documentUtils';

interface DocumentProgressChartProps {
  documents: Document[];
  tasks?: Task[];
  className?: string;
}

// Color Palette specifically tailored for formal Vietnamese administrative styling
const STATUS_COLORS = {
  COMPLETED: '#10b981',   // Emerald 500
  IN_TIME: '#3b82f6',     // Blue 500
  DUE_SOON: '#f59e0b',    // Amber 500
  DUE_TODAY: '#f97316',   // Orange 500
  OVERDUE: '#ef4444',     // Red 500
  NO_DEADLINE: '#94a3b8', // Slate 400
};

const URGENCY_COLORS = {
  HOA_TOC: '#dc2626',      // Red 600
  THUONG_KHAN: '#ea580c',  // Orange 600
  KHAN: '#d97706',         // Amber 600
  THUONG: '#2563eb',       // Blue 600
};

export default function DocumentProgressChart({ documents, tasks = [], className = '' }: DocumentProgressChartProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DONUT' | 'DEPARTMENT'>('OVERVIEW');
  const [selectedStatusGroup, setSelectedStatusGroup] = useState<string | null>(null);

  // Group and compute comprehensive statistical data
  const stats = useMemo(() => {
    let completed = 0;
    let inTime = 0;
    let dueSoon = 0;
    let dueToday = 0;
    let overdue = 0;
    let noDeadline = 0;

    let urgentCount = 0;
    let urgentOverdue = 0;

    const deptMap: Record<string, { total: number; completed: number; inProgress: number; overdue: number }> = {};

    documents.forEach((doc) => {
      const pStatus = getDocumentProgressStatus(doc);
      const isUrgent = !!(doc.urgency && doc.urgency !== 'Thường');
      if (isUrgent) urgentCount++;

      const procResult = (doc.processingResult || '').toUpperCase();
      const isDocCompleted = procResult === 'COMPLETED' || procResult === 'ĐÃ HOÀN THÀNH' || procResult === 'HOÀN THÀNH' || (doc.status as string) === 'COMPLETED';

      if (isDocCompleted) {
        completed++;
      } else if (pStatus.type === 'OVERDUE') {
        overdue++;
        if (isUrgent) urgentOverdue++;
      } else if (pStatus.type === 'DUE_TODAY') {
        dueToday++;
      } else if (pStatus.type === 'DUE_SOON') {
        dueSoon++;
      } else if (pStatus.type === 'IN_TIME') {
        inTime++;
      } else {
        noDeadline++;
      }

      // Department breakdown
      const dept = doc.leadDepartment || 'Chưa phân công';
      if (!deptMap[dept]) {
        deptMap[dept] = { total: 0, completed: 0, inProgress: 0, overdue: 0 };
      }
      deptMap[dept].total++;
      if (isDocCompleted) {
        deptMap[dept].completed++;
      } else if (pStatus.type === 'OVERDUE') {
        deptMap[dept].overdue++;
      } else {
        deptMap[dept].inProgress++;
      }
    });

    const totalActive = documents.length;
    const resolvedRate = totalActive > 0 ? Math.round(((completed) / totalActive) * 100) : 0;
    const onTimeRate = totalActive > 0 ? Math.round(((totalActive - overdue) / totalActive) * 100) : 100;

    // Data for Overview Bar Chart
    const barData = [
      {
        category: 'Đã hoàn thành',
        shortName: 'Đã xử lý',
        count: completed,
        fill: STATUS_COLORS.COMPLETED,
        filterKey: 'COMPLETED',
        description: 'Văn bản đã có kết quả giải quyết & ban hành kết luận'
      },
      {
        category: 'Trong thời hạn',
        shortName: 'Trong hạn',
        count: inTime,
        fill: STATUS_COLORS.IN_TIME,
        filterKey: 'IN_TIME',
        description: 'Văn bản đang xử lý, còn nhiều hơn 3 ngày'
      },
      {
        category: 'Sắp đến hạn (≤3d)',
        shortName: 'Sắp đến hạn',
        count: dueSoon,
        fill: STATUS_COLORS.DUE_SOON,
        filterKey: 'DUE_SOON',
        description: 'Cần đôn đốc khẩn trương hoàn thành trong 1-3 ngày'
      },
      {
        category: 'Đến hạn hôm nay',
        shortName: 'Đến hạn hôm nay',
        count: dueToday,
        fill: STATUS_COLORS.DUE_TODAY,
        filterKey: 'DUE_TODAY',
        description: 'Mốc thời gian xử lý bắt buộc trong ngày hôm nay'
      },
      {
        category: 'Đã quá hạn',
        shortName: 'Quá hạn',
        count: overdue,
        fill: STATUS_COLORS.OVERDUE,
        filterKey: 'OVERDUE',
        description: 'Trễ thời hạn giao việc theo quy chế làm việc'
      },
      {
        category: 'Theo quy chế',
        shortName: 'Quy chế chung',
        count: noDeadline,
        fill: STATUS_COLORS.NO_DEADLINE,
        filterKey: 'NO_DEADLINE',
        description: 'Văn bản lưu trữ, tra cứu hoặc không ấn định hạn cụ thể'
      }
    ];

    // Data for Donut Pie Chart
    const pieData = [
      { name: 'Đã xử lý', value: completed, color: STATUS_COLORS.COMPLETED, key: 'COMPLETED' },
      { name: 'Trong hạn', value: inTime, color: STATUS_COLORS.IN_TIME, key: 'IN_TIME' },
      { name: 'Sắp đến hạn', value: dueSoon, color: STATUS_COLORS.DUE_SOON, key: 'DUE_SOON' },
      { name: 'Đến hạn hôm nay', value: dueToday, color: STATUS_COLORS.DUE_TODAY, key: 'DUE_TODAY' },
      { name: 'Quá hạn', value: overdue, color: STATUS_COLORS.OVERDUE, key: 'OVERDUE' },
      { name: 'Quy chế', value: noDeadline, color: STATUS_COLORS.NO_DEADLINE, key: 'NO_DEADLINE' }
    ].filter(item => item.value > 0);

    // Data for Department Breakdown (Top 6 departments)
    const departmentData = Object.entries(deptMap)
      .map(([name, data]) => ({
        name: name.length > 22 ? name.substring(0, 20) + '...' : name,
        fullName: name,
        'Đã xử lý': data.completed,
        'Đang xử lý': data.inProgress,
        'Quá hạn': data.overdue,
        total: data.total
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);

    return {
      total: totalActive,
      completed,
      inTime,
      dueSoon,
      dueToday,
      overdue,
      noDeadline,
      urgentCount,
      urgentOverdue,
      resolvedRate,
      onTimeRate,
      barData,
      pieData,
      departmentData
    };
  }, [documents]);

  const handleBarClick = (entry: any) => {
    if (!entry) return;
    const filterKey = entry.filterKey || entry.activePayload?.[0]?.payload?.filterKey;
    if (filterKey === 'OVERDUE') {
      navigate('/documents?filter=OVERDUE');
    } else if (filterKey === 'DUE_TODAY') {
      navigate('/documents?filter=DUE_TODAY');
    } else if (filterKey === 'IN_TIME' || filterKey === 'DUE_SOON') {
      navigate('/documents?filter=IN_TIME');
    } else {
      navigate('/documents');
    }
  };

  // Custom Chart Tooltip
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700 min-w-[200px]">
          <div className="font-bold flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5 mb-1.5">
            <span>{data.category}</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-black" style={{ backgroundColor: data.fill, color: '#fff' }}>
              {data.count} VB
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">{data.description}</p>
          <div className="mt-2 text-[10px] text-blue-300 font-semibold flex items-center justify-between">
            <span>Tỷ trọng:</span>
            <span>{stats.total > 0 ? ((data.count / stats.total) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700">
          <div className="font-bold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.payload.color }}></span>
            <span>{data.name}</span>
          </div>
          <div className="mt-1 text-sm font-black text-slate-100 flex items-center justify-between gap-4">
            <span>Số lượng:</span>
            <span>{data.value} văn bản</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Chiếm {stats.total > 0 ? ((data.value / stats.total) * 100).toFixed(1) : 0}% tổng số hồ sơ
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden ${className}`}>
      {/* Card Header & Controls */}
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-blue-50/30 to-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-blue-600" />
              Biểu đồ Giám sát Tiến độ
            </span>
            {stats.overdue > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-md flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                {stats.overdue} văn bản trễ hạn
              </span>
            )}
          </div>
          <h2 className="text-base font-black text-slate-900 mt-1 uppercase tracking-wide">
            Thống Kê Tiến Độ Xử Lý Văn Bản & Đôn Đốc Hạn Định
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Trực quan hóa khối lượng văn bản theo trạng thái (Đã xử lý, Đang xử lý / Đến hạn, Quá hạn) trên hệ thống
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-2xl flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'OVERVIEW'
                ? 'bg-white text-blue-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Phân bổ Tiến độ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DONUT')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'DONUT'
                ? 'bg-white text-blue-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>Cơ cấu Tỷ lệ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DEPARTMENT')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'DEPARTMENT'
                ? 'bg-white text-blue-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Theo Cơ quan</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Highlight KPI Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 sm:p-6 bg-slate-50/50 border-b border-slate-100">
        <div 
          onClick={() => navigate('/documents?filter=COMPLETED')}
          className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Đã Xử Lý / Xong
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
              {stats.resolvedRate}%
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-1 leading-none">{stats.completed}</div>
          <p className="text-[10px] text-slate-500 mt-1">Đã giải quyết & kết luận</p>
        </div>

        <div 
          onClick={() => navigate('/documents?filter=IN_TIME')}
          className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Đang Xử Lý / Trong Hạn
            </span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
              {stats.inTime + stats.dueSoon + stats.dueToday}
            </span>
          </div>
          <div className="text-2xl font-black text-blue-800 mt-1 leading-none">
            {stats.inTime + stats.dueSoon + stats.dueToday}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Gồm {stats.dueSoon + stats.dueToday} hồ sơ gấp</p>
        </div>

        <div 
          onClick={() => navigate('/documents?filter=OVERDUE')}
          className={`bg-white p-3.5 rounded-2xl border shadow-2xs hover:shadow-xs transition-all cursor-pointer group ${
            stats.overdue > 0 ? 'border-red-200 bg-red-50/20 hover:border-red-400' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              Quá Hạn Xử Lý
            </span>
            {stats.overdue > 0 && (
              <span className="text-[10px] font-black text-red-700 bg-red-100 px-1.5 py-0.2 rounded">
                Gấp
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-red-700 mt-1 leading-none">{stats.overdue}</div>
          <p className="text-[10px] text-red-600/80 mt-1">Cần đốc thúc xử lý ngay</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
              Tỷ Lệ Đúng Hạn
            </span>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
              KPI Cấp Ủy
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-800 mt-1 leading-none">{stats.onTimeRate}%</div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${stats.onTimeRate}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Chart Rendering Canvas */}
      <div className="p-4 sm:p-6">
        {stats.total === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Chưa có đủ dữ liệu văn bản để vẽ biểu đồ thống kê. Hãy tiếp nhận thêm văn bản để hệ thống phân tích.
          </div>
        ) : activeTab === 'OVERVIEW' ? (
          <div className="space-y-4">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.barData}
                  margin={{ top: 10, right: 15, left: -20, bottom: 25 }}
                  onClick={handleBarClick}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="shortName" 
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis 
                    allowDecimals={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                  <Bar 
                    dataKey="count" 
                    radius={[8, 8, 0, 0]}
                    className="cursor-pointer transition-all duration-200 hover:opacity-85"
                  >
                    {stats.barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.COMPLETED }}></span>
                <span>Đã xử lý: <strong>{stats.completed}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.IN_TIME }}></span>
                <span>Trong hạn: <strong>{stats.inTime}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.DUE_SOON }}></span>
                <span>Sắp đến hạn: <strong>{stats.dueSoon}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.DUE_TODAY }}></span>
                <span>Đến hạn hôm nay: <strong>{stats.dueToday}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.OVERDUE }}></span>
                <span className="text-red-700 font-bold">Quá hạn: {stats.overdue}</span>
              </div>
            </div>
          </div>
        ) : activeTab === 'DONUT' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-[260px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      const key = entry?.key || entry?.payload?.key;
                      if (key === 'OVERDUE') navigate('/documents?filter=OVERDUE');
                      else if (key === 'DUE_TODAY' || key === 'DUE_SOON' || key === 'IN_TIME') navigate('/documents?filter=IN_TIME');
                      else if (key === 'COMPLETED') navigate('/documents?filter=COMPLETED');
                      else navigate('/documents');
                    }}
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Inner Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tổng số</span>
                <span className="text-2xl font-black text-slate-900 leading-none">{stats.total}</span>
                <span className="text-[10px] text-blue-600 font-bold mt-0.5">{stats.onTimeRate}% đúng hạn</span>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                Chi tiết tỷ trọng hồ sơ văn bản
              </h4>
              {stats.pieData.map((item, idx) => {
                const percent = stats.total > 0 ? ((item.value / stats.total) * 100).toFixed(1) : '0';
                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      if (item.key === 'OVERDUE') navigate('/documents?filter=OVERDUE');
                      else if (item.key === 'IN_TIME' || item.key === 'DUE_SOON' || item.key === 'DUE_TODAY') navigate('/documents?filter=IN_TIME');
                      else navigate('/documents');
                    }}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-3.5 h-3.5 rounded-md flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="text-xs font-bold text-slate-800">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-900">{item.value} VB</span>
                      <span className="text-[11px] font-semibold text-slate-400 w-12 text-right">{percent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Department Workload View */
          <div className="space-y-4">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.departmentData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                    width={110}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700">
                            <div className="font-black text-blue-300 border-b border-slate-700 pb-1 mb-1.5">
                              {data.fullName}
                            </div>
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between gap-4 text-emerald-400 font-bold">
                                <span>Đã hoàn thành:</span>
                                <span>{data['Đã xử lý']}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-blue-300 font-semibold">
                                <span>Đang thực hiện:</span>
                                <span>{data['Đang xử lý']}</span>
                              </div>
                              <div className="flex justify-between gap-4 text-red-400 font-bold">
                                <span>Quá hạn:</span>
                                <span>{data['Quá hạn']}</span>
                              </div>
                              <div className="flex justify-between gap-4 border-t border-slate-700 pt-1 font-black text-white">
                                <span>Tổng số văn bản:</span>
                                <span>{data.total}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Đã xử lý" stackId="a" fill={STATUS_COLORS.COMPLETED} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Đang xử lý" stackId="a" fill={STATUS_COLORS.IN_TIME} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Quá hạn" stackId="a" fill={STATUS_COLORS.OVERDUE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-400 text-center italic">
              * Biểu đồ thể hiện tiến độ xử lý và khối lượng công việc được giao theo từng cơ quan, ban ngành chủ trì.
            </p>
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 px-6">
        <span className="text-[11px] text-slate-500 font-medium">
          Dữ liệu thời gian thực được đồng bộ trực tiếp từ Sổ Văn Bản Đến & Bảng Nhiệm Vụ Cấp Ủy
        </span>
        <button
          type="button"
          onClick={() => navigate('/documents')}
          className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>Xem chi tiết danh sách văn bản</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
