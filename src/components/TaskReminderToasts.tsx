import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, AlertTriangle, Clock, CheckCircle2, X, ChevronRight, 
  Sparkles, Filter, ExternalLink, Calendar, Building2, Flame,
  Check, Volume2, VolumeX
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Task, Document } from '../types';

export type DeadlineUrgency = 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON';

export interface ReminderItem {
  id: string;
  type: 'TASK' | 'DOC';
  title: string;
  assignedDept?: string | null;
  docNumber?: string | null;
  dueDateStr: string;
  dueDate: Date;
  daysDiff: number;
  urgency: DeadlineUrgency;
  status?: string;
  sourceDocId?: string;
}

interface TaskReminderToastsProps {
  tasks: Task[];
  documents?: Document[];
  onRefresh?: () => void;
}

// Utility to parse various Vietnamese and ISO date string formats
export function parseDateString(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const str = dateStr.trim();

  // Try YYYY-MM-DD format
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY format
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function TaskReminderToasts({ tasks, documents = [], onRefresh }: TaskReminderToastsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [filterUrgency, setFilterUrgency] = useState<'ALL' | 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON'>('ALL');
  const [isMinimized, setIsMinimized] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);
  const navigate = useNavigate();

  // Compute upcoming reminders
  const reminders = useMemo(() => {
    const items: ReminderItem[] = [];
    const now = new Date();
    // Normalize today to midnight for fair day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Process tasks that are not completed
    for (const task of tasks) {
      if (task.status === 'COMPLETED' || (task.id && completedIds.has(task.id))) continue;
      if (!task.dueDate) continue;

      const dueDateObj = parseDateString(task.dueDate);
      if (!dueDateObj) continue;

      const taskDateAtMidnight = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
      const diffTime = taskDateAtMidnight.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

      let urgency: DeadlineUrgency | null = null;
      if (diffDays < 0) {
        urgency = 'OVERDUE';
      } else if (diffDays === 0) {
        urgency = 'DUE_TODAY';
      } else if (diffDays <= 3) {
        urgency = 'DUE_SOON';
      }

      if (urgency) {
        const id = task.id || `task-${task.title}-${task.dueDate}`;
        items.push({
          id,
          type: 'TASK',
          title: task.title,
          assignedDept: task.assignedOrganization,
          docNumber: task.sourceDocumentNumber,
          dueDateStr: task.dueDate,
          dueDate: dueDateObj,
          daysDiff: diffDays,
          urgency,
          status: task.status,
          sourceDocId: task.sourceDocumentId
        });
      }
    }

    // 2. Process documents with action deadlines if not already covered
    for (const docItem of documents) {
      if (!docItem.actionDeadline) continue;
      const dueDateObj = parseDateString(docItem.actionDeadline);
      if (!dueDateObj) continue;

      const docDateAtMidnight = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
      const diffTime = docDateAtMidnight.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

      let urgency: DeadlineUrgency | null = null;
      if (diffDays < 0) {
        urgency = 'OVERDUE';
      } else if (diffDays === 0) {
        urgency = 'DUE_TODAY';
      } else if (diffDays <= 2) {
        urgency = 'DUE_SOON';
      }

      if (urgency) {
        const id = `doc-${docItem.id}`;
        // Avoid duplicate if task already linked to this doc
        if (!items.some(it => it.sourceDocId === docItem.id)) {
          items.push({
            id,
            type: 'DOC',
            title: docItem.title || docItem.fileName || 'Văn bản cần xử lý',
            assignedDept: docItem.leadDepartment,
            docNumber: docItem.documentNumber,
            dueDateStr: docItem.actionDeadline,
            dueDate: dueDateObj,
            daysDiff: diffDays,
            urgency,
            sourceDocId: docItem.id
          });
        }
      }
    }

    // Sort by urgency: OVERDUE first, then DUE_TODAY, then DUE_SOON, then earliest date
    return items.sort((a, b) => {
      const order = { OVERDUE: 0, DUE_TODAY: 1, DUE_SOON: 2 };
      if (order[a.urgency] !== order[b.urgency]) {
        return order[a.urgency] - order[b.urgency];
      }
      return a.daysDiff - b.daysDiff;
    });
  }, [tasks, documents, completedIds]);

  // Active reminders excluding dismissed
  const activeReminders = useMemo(() => {
    return reminders.filter(r => !dismissedIds.has(r.id));
  }, [reminders, dismissedIds]);

  // Filtered active reminders
  const filteredReminders = useMemo(() => {
    if (filterUrgency === 'ALL') return activeReminders;
    return activeReminders.filter(r => r.urgency === filterUrgency);
  }, [activeReminders, filterUrgency]);

  // Counts
  const counts = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let dueSoon = 0;
    for (const r of activeReminders) {
      if (r.urgency === 'OVERDUE') overdue++;
      if (r.urgency === 'DUE_TODAY') dueToday++;
      if (r.urgency === 'DUE_SOON') dueSoon++;
    }
    return { overdue, dueToday, dueSoon, total: activeReminders.length };
  }, [activeReminders]);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  };

  const handleDismissAll = () => {
    const allIds = new Set(activeReminders.map(r => r.id));
    setDismissedIds(allIds);
  };

  const handleQuickCompleteTask = async (item: ReminderItem) => {
    if (item.type !== 'TASK' || !item.id || item.id.startsWith('task-')) {
      // If doc or non-firestore id, navigate to tasks or doc page
      if (item.sourceDocId) {
        navigate(`/documents/${item.sourceDocId}`);
      } else {
        navigate('/tasks');
      }
      return;
    }

    setCompletingId(item.id);
    try {
      await updateDoc(doc(db, 'tasks', item.id), {
        status: 'COMPLETED'
      });
      setCompletedIds(prev => new Set(prev).add(item.id));
      setToastFeedback(`Đã đánh dấu hoàn thành nhiệm vụ "${item.title.substring(0, 30)}..."`);
      setTimeout(() => setToastFeedback(null), 4000);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to complete task:", e);
    } finally {
      setCompletingId(null);
    }
  };

  if (activeReminders.length === 0 && !toastFeedback) {
    return null; // No upcoming deadlines to notify
  }

  return (
    <>
      {/* Toast Feedback Notification Banner */}
      <AnimatePresence>
        {toastFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 bg-emerald-900 text-emerald-100 border border-emerald-500/50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold backdrop-blur-md"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 animate-bounce" />
            <span>{toastFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom-Right Toast Reminders Widget */}
      <div className="fixed bottom-5 right-5 z-40 max-w-md w-full px-2 sm:px-0 pointer-events-none">
        <div className="pointer-events-auto space-y-3">
          
          {/* Main Container Card */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="bg-gradient-to-b from-blue-950 to-indigo-950 text-slate-100 rounded-3xl border border-blue-700/80 shadow-2xl backdrop-blur-xl overflow-hidden ring-1 ring-white/10"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 border-b border-blue-700/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg ${
                    counts.overdue > 0 ? 'bg-red-600 animate-pulse ring-2 ring-red-400/40' : 'bg-blue-600'
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  {counts.total > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black rounded-full h-5 min-w-5 px-1 flex items-center justify-center border-2 border-blue-950 shadow-md">
                      {counts.total}
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Nhắc Nhở Hạn Xử Lý</h3>
                    <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-300 text-[9px] font-extrabold rounded border border-amber-400/30">
                      LIVE
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {counts.overdue > 0 
                      ? `⚠️ Có ${counts.overdue} nhiệm vụ đã quá hạn!` 
                      : `Phát hiện ${counts.total} công việc cần chú ý`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors text-xs font-bold"
                  title={isMinimized ? "Phóng to" : "Thu gọn"}
                >
                  {isMinimized ? "Hiện" : "Ẩn"}
                </button>
                <button
                  onClick={handleDismissAll}
                  className="p-1.5 text-slate-400 hover:text-red-300 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Đóng tất cả thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded Toast Body */}
            {!isMinimized && (
              <div className="p-3 space-y-3">
                {/* Filter Selector Tabs */}
                <div className="flex items-center justify-between gap-1 bg-blue-900/80 p-1 rounded-xl border border-blue-700/80 text-[10px] font-bold">
                  <button
                    onClick={() => setFilterUrgency('ALL')}
                    className={`flex-1 py-1 px-2 rounded-lg transition-all ${
                      filterUrgency === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tất cả ({counts.total})
                  </button>
                  {counts.overdue > 0 && (
                    <button
                      onClick={() => setFilterUrgency('OVERDUE')}
                      className={`py-1 px-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                        filterUrgency === 'OVERDUE' ? 'bg-red-600 text-white shadow-xs' : 'text-red-400 hover:text-red-300'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
                      Quá hạn ({counts.overdue})
                    </button>
                  )}
                  {counts.dueToday > 0 && (
                    <button
                      onClick={() => setFilterUrgency('DUE_TODAY')}
                      className={`py-1 px-2 rounded-lg transition-all ${
                        filterUrgency === 'DUE_TODAY' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      Hôm nay ({counts.dueToday})
                    </button>
                  )}
                  {counts.dueSoon > 0 && (
                    <button
                      onClick={() => setFilterUrgency('DUE_SOON')}
                      className={`py-1 px-2 rounded-lg transition-all ${
                        filterUrgency === 'DUE_SOON' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-400 hover:text-blue-300'
                      }`}
                    >
                      Sắp tới ({counts.dueSoon})
                    </button>
                  )}
                </div>

                {/* Reminder Cards List */}
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  <AnimatePresence>
                    {filteredReminders.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500 italic">
                        Không có nhắc nhở nào theo bộ lọc đã chọn.
                      </div>
                    ) : (
                      filteredReminders.map((item) => {
                        const isOverdue = item.urgency === 'OVERDUE';
                        const isToday = item.urgency === 'DUE_TODAY';

                        const cardBg = isOverdue
                          ? 'bg-red-950/40 border-red-800/60 hover:border-red-600/80'
                          : isToday
                            ? 'bg-amber-950/30 border-amber-800/60 hover:border-amber-600/80'
                            : 'bg-slate-950/50 border-slate-800 hover:border-slate-700';

                        const badgeBg = isOverdue
                          ? 'bg-red-500/20 text-red-300 border-red-500/30'
                          : isToday
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30';

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`p-3 rounded-2xl border transition-all space-y-2 relative group ${cardBg}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 ${badgeBg}`}>
                                  {isOverdue ? (
                                    <>
                                      <AlertTriangle className="w-2.5 h-2.5 text-red-400 animate-bounce" />
                                      <span>Quá hạn {Math.abs(item.daysDiff)} ngày</span>
                                    </>
                                  ) : isToday ? (
                                    <>
                                      <Flame className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                                      <span>Đến hạn Hôm Nay</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-2.5 h-2.5 text-blue-400" />
                                      <span>Còn {item.daysDiff} ngày</span>
                                    </>
                                  )}
                                </span>

                                {item.docNumber && (
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                    {item.docNumber}
                                  </span>
                                )}

                                {item.assignedDept && (
                                  <span className="text-[10px] text-slate-300 font-medium flex items-center gap-1">
                                    <Building2 className="w-2.5 h-2.5 text-slate-400" />
                                    <span>{item.assignedDept}</span>
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() => handleDismiss(item.id)}
                                className="text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-slate-800 transition-colors flex-shrink-0"
                                title="Đóng nhắc nhở này"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Title */}
                            <h4 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug">
                              {item.title}
                            </h4>

                            {/* Actions bar */}
                            <div className="pt-1.5 flex items-center justify-between border-t border-slate-800/60 text-[10px]">
                              <span className="text-slate-400 font-medium flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                Hạn: <strong className="text-slate-200">{item.dueDateStr}</strong>
                              </span>

                              <div className="flex items-center gap-2">
                                {item.type === 'TASK' && (
                                  <button
                                    onClick={() => handleQuickCompleteTask(item)}
                                    disabled={completingId === item.id}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                                    title="Đánh dấu đã hoàn thành nhiệm vụ này ngay lập tức"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Hoàn thành</span>
                                  </button>
                                )}

                                {item.sourceDocId ? (
                                  <Link
                                    to={`/documents/${item.sourceDocId}`}
                                    className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white font-bold rounded-lg transition-all flex items-center gap-1 border border-blue-500/30"
                                  >
                                    <span>Chi tiết</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </Link>
                                ) : (
                                  <Link
                                    to="/tasks"
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-all flex items-center gap-1"
                                  >
                                    <span>Xem bảng Kanban</span>
                                    <ChevronRight className="w-2.5 h-2.5" />
                                  </Link>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer link to full tasks board */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Cập nhật tự động từ hệ thống</span>
                  <Link
                    to="/tasks"
                    className="font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    <span>Mở Bảng Đôn Đốc Nhiệm Vụ</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}

// Summary Alert Banner Component for insertion directly into Dashboard header/top
export function TaskReminderAlertBanner({ tasks, documents = [] }: { tasks: Task[]; documents?: Document[] }) {
  const navigate = useNavigate();

  const reminderCounts = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let dueSoon = 0;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const t of tasks) {
      if (t.status === 'COMPLETED' || !t.dueDate) continue;
      const d = parseDateString(t.dueDate);
      if (!d) continue;

      const tDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.round((tDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

      if (diffDays < 0) overdue++;
      else if (diffDays === 0) dueToday++;
      else if (diffDays <= 3) dueSoon++;
    }

    return { overdue, dueToday, dueSoon, total: overdue + dueToday + dueSoon };
  }, [tasks]);

  if (reminderCounts.total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
        reminderCounts.overdue > 0
          ? 'bg-gradient-to-r from-red-900/90 via-slate-900 to-red-950 text-white border-red-500/40 ring-1 ring-red-500/30'
          : 'bg-gradient-to-r from-amber-900/90 via-slate-900 to-amber-950 text-white border-amber-500/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-md ${
          reminderCounts.overdue > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-600'
        }`}>
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              {reminderCounts.overdue > 0 ? 'Cảnh Báo Nóng: Nhiệm Vụ Quá Hạn' : 'Thông Báo: Nhiệm Vụ Sắp Đến Hạn'}
            </h4>
            {reminderCounts.overdue > 0 && (
              <span className="px-2 py-0.2 bg-red-500 text-white text-[9px] font-black rounded uppercase animate-bounce">
                CẤP BÁCH
              </span>
            )}
          </div>

          <p className="text-xs text-slate-200 mt-0.5 leading-snug">
            {reminderCounts.overdue > 0 && (
              <strong className="text-red-300 font-extrabold mr-1.5">
                • {reminderCounts.overdue} nhiệm vụ đã quá hạn xử lý!
              </strong>
            )}
            {reminderCounts.dueToday > 0 && (
              <span className="text-amber-300 font-bold mr-1.5">
                • {reminderCounts.dueToday} nhiệm vụ đến hạn hôm nay.
              </span>
            )}
            {reminderCounts.dueSoon > 0 && (
              <span className="text-blue-200 font-medium">
                • {reminderCounts.dueSoon} nhiệm vụ sẽ đến hạn trong 3 ngày tới.
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <Link
          to="/tasks"
          className="px-3.5 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md active:scale-95"
        >
          <span>Xử lý ngay</span>
          <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
        </Link>
      </div>
    </motion.div>
  );
}
