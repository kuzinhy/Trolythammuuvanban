import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, Clock, AlertTriangle, CheckCircle2, ShieldAlert, FileText, 
  CheckSquare, Filter, RefreshCw, Calendar, Sparkles, FileCheck, AlertCircle
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Document, Task } from '../types';
import DocumentProgressChart from '../components/DocumentProgressChart';
import { TaskReminderAlertBanner } from '../components/TaskReminderToasts';
import { getDocumentProgressStatus, isUrgentDocument, isDocumentCompleted } from '../lib/documentUtils';
import { useNavigate } from 'react-router';

export default function Statistics() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'OVERDUE' | 'URGENT' | 'COMPLETED'>('ALL');
  const navigate = useNavigate();

  useEffect(() => {
    const qDocs = query(collection(db, 'documents'), orderBy('createdAt', 'desc'), limit(150));
    const unsubscribeDocs = onSnapshot(qDocs, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Document));
      setDocuments(docs);
      setLoading(false);
    }, (err) => console.error("Docs stats sync error:", err));

    const qTasks = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const ts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(ts);
    }, (err) => console.error("Tasks stats sync error:", err));

    return () => {
      unsubscribeDocs();
      unsubscribeTasks();
    };
  }, []);

  // Filtered documents list for detailed review
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const isDone = isDocumentCompleted(doc);
      const status = getDocumentProgressStatus(doc);
      const urgent = isUrgentDocument(doc);

      if (filterType === 'OVERDUE') return !isDone && (status.type === 'OVERDUE' || status.type === 'DUE_TODAY');
      if (filterType === 'URGENT') return !isDone && urgent;
      if (filterType === 'COMPLETED') return isDone;
      return true;
    });
  }, [documents, filterType]);

  const metrics = useMemo(() => {
    let overdueCount = 0;
    let dueTodayCount = 0;
    let urgentCount = 0;
    let completedCount = 0;
    let pendingCount = 0;

    documents.forEach(d => {
      const isDone = isDocumentCompleted(d);
      const status = getDocumentProgressStatus(d);
      const urgent = isUrgentDocument(d);

      if (isDone) {
        completedCount++;
      } else {
        pendingCount++;
        if (status.type === 'OVERDUE') overdueCount++;
        if (status.type === 'DUE_TODAY') dueTodayCount++;
        if (urgent) urgentCount++;
      }
    });

    return {
      total: documents.length,
      overdueCount,
      dueTodayCount,
      urgentCount,
      completedCount,
      pendingCount,
      completionRate: documents.length > 0 ? Math.round((completedCount / documents.length) * 100) : 0
    };
  }, [documents]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-blue-500/10 skew-x-12 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/30 text-blue-200 border border-blue-400/30 text-xs font-bold rounded-full backdrop-blur-xs flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                Giám Sát & Đôn Đốc Tiến Độ Văn Bản
              </span>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full">
                Tỷ lệ xử lý: {metrics.completionRate}%
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Thống Kê Tiến Độ Xử Lý & Đôn Đốc Hạn Định
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Tổng hợp biểu đồ phân tích tiến độ giải quyết văn bản đến, cảnh báo hạn định xử lý khẩn và danh sách nhiệm vụ được giao.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/tasks')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Giao Nhiệm Vụ Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Đôn Đốc Hạn Định Banner Alert Component */}
      <TaskReminderAlertBanner documents={documents} tasks={tasks} />

      {/* 2. Recharts Progress & Deadline Chart */}
      <DocumentProgressChart documents={documents} tasks={tasks} />

      {/* 3. Detailed Document Deadline Monitoring List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Chi Tiết Hạn Định Văn Bản</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rà soát danh sách văn bản cần đôn đốc xử lý theo mức độ ưu tiên
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({documents.length})
            </button>
            <button
              onClick={() => setFilterType('OVERDUE')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'OVERDUE' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-red-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Quá hạn ({metrics.overdueCount + metrics.dueTodayCount})</span>
            </button>
            <button
              onClick={() => setFilterType('URGENT')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'URGENT' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Khẩn ({metrics.urgentCount})</span>
            </button>
            <button
              onClick={() => setFilterType('COMPLETED')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'COMPLETED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã xử lý ({metrics.completedCount})</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Đang tải danh sách theo dõi tiến độ...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-10 text-center bg-slate-50 rounded-2xl text-xs text-slate-500 font-bold">
            Không có văn bản nào trong mục đã chọn.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDocs.slice(0, 15).map(doc => {
              const status = getDocumentProgressStatus(doc);
              const isDone = isDocumentCompleted(doc);
              const urgent = isUrgentDocument(doc);

              return (
                <div 
                  key={doc.id} 
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="py-3 px-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {doc.documentNumber || 'K/SỐ'}
                      </span>
                      {urgent && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded border border-red-200">
                          {doc.urgency}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">{doc.issuer}</span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                      {doc.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-700">
                        {doc.actionDeadline ? `Hạn: ${doc.actionDeadline}` : (doc.deadlines?.[0] ? `Hạn: ${doc.deadlines[0]}` : 'Không có hạn')}
                      </div>
                      <div className={`text-[11px] font-bold ${
                        isDone ? 'text-emerald-600' :
                        status.type === 'OVERDUE' ? 'text-red-600' :
                        status.type === 'DUE_TODAY' ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        {isDone ? 'Đã hoàn thành' : status.label}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
