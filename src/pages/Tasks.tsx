import { useEffect, useState, useMemo, useCallback, type FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Loader2, FileText, CheckCircle2, Clock, Play, Building2, 
  Search, Filter, AlertTriangle, X, Plus, Download, Calendar, 
  Check, Layers, ChevronRight, Sparkles
} from 'lucide-react';
import { Task } from '../types';
import { Link } from 'react-router';
import { useAuthStore } from '../store/authStore';

export default function Tasks() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('KANBAN');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');

  // Manual Task Creation State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssignedOrg, setNewAssignedOrg] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(150));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isMounted) return;
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(taskList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tasks:", error);
      if (isMounted) setLoading(false);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleUpdateStatus = useCallback(async (taskId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus
      });
    } catch (e) {
      console.error("Error updating task status:", e);
    }
  }, []);

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsCreatingTask(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: newTitle.trim(),
        description: newDescription.trim(),
        assignedOrganization: newAssignedOrg.trim() || 'Văn phòng Đảng ủy',
        dueDate: newDueDate || '',
        priority: newPriority,
        status: 'PENDING',
        createdBy: user?.uid || '',
        createdAt: serverTimestamp()
      });

      // Reset form
      setNewTitle('');
      setNewDescription('');
      setNewAssignedOrg('');
      setNewDueDate('');
      setNewPriority('NORMAL');
      setShowCreateModal(false);
    } catch (err) {
      console.error("Error creating task:", err);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ["Số thứ tự", "Nhiệm vụ", "Nội dung chi tiết", "Đơn vị chủ trì / phụ trách", "Hạn xử lý", "Trạng thái"];
    const rows = filteredTasks.map((task, idx) => [
      idx + 1,
      `"${(task.title || '').replace(/"/g, '""')}"`,
      `"${(task.description || '').replace(/"/g, '""')}"`,
      `"${(task.assignedOrganization || '').replace(/"/g, '""')}"`,
      `"${task.dueDate || 'Không thời hạn'}"`,
      `"${task.status === 'COMPLETED' ? 'Đã hoàn thành' : task.status === 'IN_PROGRESS' ? 'Đang thực hiện' : 'Chờ xử lý'}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_Cao_Nhiem_Vu_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const departments = useMemo(() => {
    const depts = new Set<string>();
    tasks.forEach(t => {
      if (t.assignedOrganization) depts.add(t.assignedOrganization);
    });
    return Array.from(depts);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return tasks.filter(task => {
      if (selectedDept !== 'ALL' && task.assignedOrganization !== selectedDept) {
        return false;
      }
      if (selectedPriority !== 'ALL') {
        const p = (task as any).priority || 'NORMAL';
        if (p !== selectedPriority) return false;
      }
      if (term) {
        const matchesTitle = task.title?.toLowerCase().includes(term);
        const matchesDesc = task.description?.toLowerCase().includes(term);
        const matchesDept = task.assignedOrganization?.toLowerCase().includes(term);
        if (!matchesTitle && !matchesDesc && !matchesDept) return false;
      }
      return true;
    });
  }, [tasks, searchTerm, selectedDept, selectedPriority]);

  const taskStats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    const now = new Date();

    tasks.forEach(t => {
      if (t.status === 'COMPLETED') {
        completed++;
      } else {
        if (t.status === 'IN_PROGRESS') inProgress++;
        else pending++;

        if (t.dueDate) {
          const d = new Date(t.dueDate);
          if (!isNaN(d.getTime()) && d < now) {
            overdue++;
          }
        }
      }
    });

    return { total: tasks.length, pending, inProgress, completed, overdue };
  }, [tasks]);

  const columns = useMemo(() => [
    { id: 'PENDING', title: 'Chờ phân công / xử lý', icon: Clock, color: 'border-slate-200 bg-slate-50/50', badgeColor: 'bg-slate-200 text-slate-700' },
    { id: 'IN_PROGRESS', title: 'Đang triển khai thực hiện', icon: Play, color: 'border-blue-200 bg-blue-50/30', badgeColor: 'bg-blue-100 text-blue-800' },
    { id: 'COMPLETED', title: 'Đã hoàn thành / Báo cáo', icon: CheckCircle2, color: 'border-emerald-200 bg-emerald-50/30', badgeColor: 'bg-emerald-100 text-emerald-800' }
  ], []);

  // Partition filtered tasks in a single pass
  const partitionedTasks = useMemo(() => {
    const map: Record<string, Task[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      COMPLETED: [],
    };
    for (const t of filteredTasks) {
      const st = t.status || 'PENDING';
      if (map[st]) {
        map[st].push(t);
      } else {
        map['PENDING'].push(t);
      }
    }
    return map;
  }, [filteredTasks]);

  return (
    <div className="space-y-5 h-full flex flex-col font-sans transform-gpu">
      {/* Header & Metrics with Google Studio Flowing Gradient Border */}
      <div className="space-y-4">
        <div className="google-studio-border google-studio-glow">
          <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 rounded-[calc(1.25rem-2px)] p-4 md:p-5 text-white shadow-lg shadow-blue-500/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs">
                    Trung Tâm Đôn Đốc
                  </span>
                  <span className="text-[10px] text-amber-200 font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    Google Studio Kanban AI
                  </span>
                </div>
                <h1 className="text-base md:text-lg font-black text-white uppercase tracking-wide drop-shadow-xs">
                  Bảng Theo Dõi & Đôn Đốc Nhiệm Vụ Cấp Ủy
                </h1>
                <p className="text-xs text-blue-50 mt-0.5 font-medium">Giám sát tiến độ thực hiện nhiệm vụ từ văn bản chỉ đạo của Đảng ủy</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-white hover:bg-blue-50 text-blue-800 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md border border-white/80 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-700" />
                  <span>Giao nhiệm vụ mới</span>
                </button>

                <button
                  onClick={handleExportCsv}
                  disabled={filteredTasks.length === 0}
                  className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/30 backdrop-blur-xs disabled:opacity-50"
                  title="Xuất báo cáo tiến độ ra CSV"
                >
                  <Download className="w-3.5 h-3.5 text-blue-100" />
                  <span>Báo cáo giao ban</span>
                </button>

                <div className="bg-black/20 p-1 rounded-xl flex text-xs font-bold border border-white/20 backdrop-blur-xs">
                  <button
                    onClick={() => setViewMode('KANBAN')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'KANBAN' ? 'bg-white text-blue-900 shadow-xs font-black' : 'text-blue-100 hover:text-white'
                    }`}
                  >
                    Bảng Kanban
                  </button>
                  <button
                    onClick={() => setViewMode('LIST')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'LIST' ? 'bg-white text-blue-900 shadow-xs font-black' : 'text-blue-100 hover:text-white'
                    }`}
                  >
                    Dạng danh sách
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng nhiệm vụ</div>
              <div className="text-xl font-black text-slate-900 mt-0.5">{taskStats.total}</div>
            </div>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đang thực hiện</div>
              <div className="text-xl font-black text-blue-600 mt-0.5">{taskStats.inProgress}</div>
            </div>
            <Play className="w-5 h-5 text-blue-600" />
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trễ hạn</div>
              <div className="text-xl font-black text-red-600 mt-0.5">{taskStats.overdue}</div>
            </div>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hoàn thành</div>
              <div className="text-xl font-black text-emerald-600 mt-0.5">{taskStats.completed}</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm nhiệm vụ, nội dung, đơn vị..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 font-semibold placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">-- Tất cả cơ quan, ban ngành --</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">-- Tất cả mức độ ưu tiên --</option>
                <option value="URGENT">🔴 Hỏa tốc / Khẩn</option>
                <option value="HIGH">🟡 Quan trọng / Cao</option>
                <option value="NORMAL">🟢 Bình thường</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : viewMode === 'KANBAN' ? (
        <div className="flex-1 flex gap-5 overflow-x-auto pb-4">
          {columns.map(col => {
            const colTasks = partitionedTasks[col.id] || [];
            return (
              <div key={col.id} className={`flex-1 min-w-[320px] max-w-md flex flex-col rounded-2xl border ${col.color}`}>
                <div className="p-3.5 border-b border-inherit flex items-center justify-between bg-white/50">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <col.icon className="w-4 h-4 text-blue-600" />
                    <span>{col.title}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${col.badgeColor}`}>
                    {colTasks.length}
                  </span>
                </div>
                
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                  {colTasks.map(task => (
                    <div key={task.id} className="bg-white p-3.5 rounded-xl shadow-2xs border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all space-y-2.5">
                      <h3 className={`font-bold text-xs ${task.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-900'} leading-snug`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}
                      
                      <div className="space-y-1 pt-1.5 border-t border-slate-100 text-[11px]">
                        {task.assignedOrganization && (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                            <span className="font-bold truncate">{task.assignedOrganization}</span>
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                            <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span>Hạn: <strong className="text-slate-800">{task.dueDate}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Action selector */}
                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                        {task.documentId && (
                          <Link 
                            to={`/documents/${task.documentId}`} 
                            className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-bold"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Xem VB</span>
                          </Link>
                        )}
                        <select 
                          value={task.status || 'PENDING'}
                          onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                          aria-label="Cập nhật trạng thái nhiệm vụ"
                          className="ml-auto text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700 outline-none hover:bg-slate-100 transition-colors"
                        >
                          <option value="PENDING">Chờ xử lý</option>
                          <option value="IN_PROGRESS">Đang thực hiện</option>
                          <option value="COMPLETED">Đã hoàn thành</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="text-center p-8 text-xs text-slate-400">
                      Không có nhiệm vụ nào
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-2xs border border-slate-200 overflow-hidden flex-1">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Nhiệm vụ</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Đơn vị phụ trách</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Hạn xử lý</th>
                  <th className="px-5 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-5 py-3 text-right text-[11px] font-black text-slate-500 uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {filteredTasks.map(task => (
                  <tr key={task.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{task.title}</div>
                      {task.description && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{task.description}</div>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-800 font-bold">
                      {task.assignedOrganization || 'Chưa phân công'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-blue-700 font-semibold">
                      {task.dueDate || 'Không thời hạn'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {task.status === 'COMPLETED' ? 'Đã hoàn thành' : task.status === 'IN_PROGRESS' ? 'Đang thực hiện' : 'Chờ xử lý'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <select 
                        value={task.status || 'PENDING'}
                        onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                        aria-label="Cập nhật trạng thái công việc"
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 outline-none hover:bg-slate-100 transition-colors"
                      >
                        <option value="PENDING">Chờ xử lý</option>
                        <option value="IN_PROGRESS">Đang thực hiện</option>
                        <option value="COMPLETED">Đã hoàn thành</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400">
                      Không tìm thấy nhiệm vụ phù hợp với điều kiện tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Task Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Plus className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Giao Nhiệm Vụ Mới
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Tên nhiệm vụ / Nội dung chỉ đạo: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Rà soát báo cáo tiến độ chuẩn bị Đại hội Đảng bộ..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Đơn vị chủ trì / chịu trách nhiệm:
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Ban Tổ chức Đảng ủy / Ban Tuyên giáo..."
                  value={newAssignedOrg}
                  onChange={(e) => setNewAssignedOrg(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Hạn hoàn thành:
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Mức độ ưu tiên:
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    <option value="NORMAL">Bình thường</option>
                    <option value="HIGH">Quan trọng / Cao</option>
                    <option value="URGENT">Hỏa tốc / Khẩn</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Mô tả chi tiết / Ghi chú yêu cầu:
                </label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú thêm về yêu cầu đầu ra, thành phần phối hợp..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTask || !newTitle.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isCreatingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Lưu & Giao nhiệm vụ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

