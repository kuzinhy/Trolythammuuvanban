import { useState, useEffect } from 'react';
import { 
  FileText, CheckSquare, Download, Printer, Calendar, 
  BarChart3, Users, Building2, AlertTriangle, CheckCircle2, RefreshCw
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Document, Task, AssignedOfficer } from '../types';

export default function Reports() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [officers, setOfficers] = useState<AssignedOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const docsSnap = await getDocs(query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(150)));
        const docs = docsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
        setDocuments(docs);

        const tasksSnap = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(150)));
        const ts = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        setTasks(ts);

        const savedOfficers = localStorage.getItem('trolycvp_officers');
        if (savedOfficers) {
          setOfficers(JSON.parse(savedOfficers));
        }
      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Compute stats
  const totalDocs = documents.length;
  const urgentDocs = documents.filter(d => d.urgency === 'KHANG_CAP' || d.urgency === 'HO_TOC').length;
  const processedDocs = documents.filter(d => d.status === 'COMPLETED' || d.status === 'DA_XU_LY').length;
  
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'pending').length;
  const overdueTasks = tasks.filter(t => {
    if (!t.dueDate || t.status === 'completed') return false;
    return new Date(t.dueDate) < new Date();
  }).length;

  const handlePrint = () => {
    window.print();
  };

  const handleExportSummary = () => {
    const reportText = `
    ĐẢNG CỘNG SẢN VIỆT NAM
    VĂN PHÒNG ĐẢNG ỦY
    --------------------------------------------------
    BÁO CÁO TỔNG HỢP CÔNG TÁC XỬ LÝ VĂN BẢN VÀ ĐÔN ĐỐC NHIỆM VỤ
    Kỳ báo cáo: ${reportPeriod === 'week' ? 'Tuần này' : reportPeriod === 'month' ? 'Tháng này' : reportPeriod === 'quarter' ? 'Quý này' : 'Năm nay'}
    Ngày lập: ${new Date().toLocaleDateString('vi-VN')}
    
    1. TỔNG QUAN VĂN BẢN ĐẾN & ĐI:
    - Tổng số văn bản tiếp nhận: ${totalDocs}
    - Văn bản khẩn/hỏa tốc: ${urgentDocs}
    - Đã xử lý xong: ${processedDocs} (${totalDocs ? Math.round((processedDocs/totalDocs)*100) : 0}%)
    
    2. CÔNG TÁC ĐÔN ĐỐC & THỰC HIỆN NHIỆM VỤ:
    - Tổng số nhiệm vụ giao: ${totalTasks}
    - Đã hoàn thành: ${completedTasks}
    - Đang thực hiện / Chờ xử lý: ${inProgressTasks}
    - Quá hạn / Cần đôn đốc: ${overdueTasks}
    
    3. ĐÁNH GIÁ CHUNG & KIẾN NGHỊ:
    - Công tác tiếp nhận, phân luồng và chuyển xử lý văn bản thực hiện đúng quy chế.
    - Hệ thống trợ lý AI hỗ trợ tự động bóc tách và phân công đạt hiệu suất cao.
    `;
    
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bao_Cao_Tong_Hop_Van_Phong_Dang_Uy_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-blue-600 font-semibold">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span>Đang tổng hợp số liệu báo cáo định kỳ...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-black uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Hệ thống Thống kê & Báo cáo Chuyên sâu</span>
          </div>
          <h1 className="text-xl font-black text-slate-900">Báo cáo Tổng hợp Công tác Văn phòng Đảng ủy</h1>
          <p className="text-xs text-slate-500 mt-0.5">Số liệu trực tuyến tự động cập nhật từ CSDL văn bản đến, nhiệm vụ và phân công chuyên viên</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setReportPeriod('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportPeriod === 'week' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Tuần
            </button>
            <button
              onClick={() => setReportPeriod('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportPeriod === 'month' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Tháng
            </button>
            <button
              onClick={() => setReportPeriod('quarter')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportPeriod === 'quarter' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Quý
            </button>
            <button
              onClick={() => setReportPeriod('year')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportPeriod === 'year' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Năm
            </button>
          </div>

          <button
            onClick={handleExportSummary}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Báo cáo (TXT/Word)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>In Báo cáo</span>
          </button>
        </div>
      </div>

      {/* Official Header Preview for Print */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm print:shadow-none print:border-none space-y-6">
        <div className="text-center border-b border-slate-200 pb-6">
          <h2 className="text-sm font-bold text-slate-700 uppercase">ĐẢNG CỘNG SẢN VIỆT NAM</h2>
          <h1 className="text-base font-black text-slate-900 uppercase mt-0.5">VĂN PHÒNG ĐẢNG ỦY</h1>
          <div className="w-24 h-0.5 bg-slate-800 mx-auto my-3"></div>
          <h3 className="text-lg font-black text-slate-900 mt-2 uppercase">BÁO CÁO TỔNG HỢP CÔNG TÁC XỬ LÝ VĂN BẢN VÀ THỰC HIỆN NHIỆM VỤ</h3>
          <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Kỳ báo cáo: {reportPeriod === 'week' ? 'Tuần này' : reportPeriod === 'month' ? 'Tháng này' : reportPeriod === 'quarter' ? 'Quý này' : 'Năm nay'} — Ngày lập: {new Date().toLocaleDateString('vi-VN')}</span>
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50/70 border border-blue-200/80 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-blue-700 mb-2">
              <span className="text-xs font-bold uppercase">Tổng Văn bản Tiếp nhận</span>
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-black text-blue-900">{totalDocs}</div>
            <div className="text-[11px] font-semibold text-blue-600 mt-1">Trong đó {urgentDocs} văn bản khẩn/hỏa tốc</div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-emerald-700 mb-2">
              <span className="text-xs font-bold uppercase">Tỷ lệ Xử lý Văn bản</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-emerald-900">
              {totalDocs ? Math.round((processedDocs / totalDocs) * 100) : 0}%
            </div>
            <div className="text-[11px] font-semibold text-emerald-700 mt-1">{processedDocs} / {totalDocs} văn bản hoàn thành</div>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200/80 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-indigo-700 mb-2">
              <span className="text-xs font-bold uppercase">Nhiệm vụ Đã Hoàn thành</span>
              <CheckSquare className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-3xl font-black text-indigo-900">{completedTasks} / {totalTasks}</div>
            <div className="text-[11px] font-semibold text-indigo-700 mt-1">{totalTasks ? Math.round((completedTasks/totalTasks)*100) : 0}% tổng nhiệm vụ giao</div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 p-5 rounded-2xl">
            <div className="flex items-center justify-between text-amber-700 mb-2">
              <span className="text-xs font-bold uppercase">Nhiệm vụ Quá hạn / Cần đôn đốc</span>
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-3xl font-black text-amber-900">{overdueTasks}</div>
            <div className="text-[11px] font-semibold text-amber-700 mt-1">Yêu cầu nhắc nhở chuyên viên</div>
          </div>
        </div>

        {/* Detailed Breakdown Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          {/* Officer Workload Breakdown */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Phân công Chuyên viên & Hiệu suất</span>
              </h4>
              <span className="text-xs font-bold text-blue-600">{officers.length} nhân sự</span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {officers.map(officer => {
                const assignedCount = tasks.filter(t => t.assigneeId === officer.id || t.assignedTo === officer.fullName).length;
                const completedCount = tasks.filter(t => (t.assigneeId === officer.id || t.assignedTo === officer.fullName) && t.status === 'completed').length;
                return (
                  <div key={officer.id} className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{officer.fullName}</div>
                      <div className="text-[10px] text-slate-500">{officer.roleType === 'DEPUTY_CHIEF' ? 'Phó Chánh Văn phòng' : 'Chuyên viên'} • {officer.department}</div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                        {assignedCount} nhiệm vụ ({completedCount} xong)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Department Workload Summary */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Tổng hợp theo Khối đơn vị & Ban Đảng</span>
              </h4>
              <span className="text-xs font-bold text-indigo-600">Đơn vị chủ trì</span>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Văn phòng Đảng ủy', count: documents.filter(d => d.issuingAuthority?.includes('Văn phòng')).length },
                { name: 'Ban Tổ chức Đảng ủy', count: documents.filter(d => d.issuingAuthority?.includes('Tổ chức')).length },
                { name: 'Ban Tuyên giáo Đảng ủy', count: documents.filter(d => d.issuingAuthority?.includes('Tuyên giáo')).length },
                { name: 'Ủy ban Kiểm tra Đảng ủy', count: documents.filter(d => d.issuingAuthority?.includes('Kiểm tra')).length },
              ].map((dept, idx) => (
                <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
                  <span className="text-xs font-bold text-slate-900">{dept.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-blue-600">{dept.count} văn bản</span>
                    <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, (dept.count / (totalDocs || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conclusion & Recommendations */}
        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-200 space-y-3">
          <h4 className="text-xs font-black text-blue-900 uppercase">Đánh giá chung của Văn phòng Đảng ủy</h4>
          <p className="text-xs text-slate-700 leading-relaxed">
            - Hệ thống Quản lý và Trợ lý CVP Đảng ủy vận hành thông suốt, kết nối dữ liệu tự động giữa các bộ phận chuyên viên và lãnh đạo.<br />
            - Công tác đôn đốc hạn xử lý văn bản và nhiệm vụ được số hóa kịp thời, giúp giảm thiểu tối đa văn bản trễ hạn.<br />
            - Đề nghị các đồng chí chuyên viên tiếp tục bám sát quy chế phối hợp, cập nhật trạng thái xử lý văn bản lên hệ thống đúng thời hạn quy định.
          </p>
        </div>
      </div>
    </div>
  );
}
