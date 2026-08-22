import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, AlertTriangle, Clock, CheckCircle2, X, ChevronRight, 
  Sparkles, Filter, ExternalLink, Calendar, Building2, Flame,
  Check
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

export function parseDateString(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const str = dateStr.trim();

  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

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

  const prevTasksCountRef = useRef(tasks.length);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevTasksCountRef.current = tasks.length;
      return;
    }

    if (tasks.length > prevTasksCountRef.current) {
      const latestTask = tasks[0];
      if (latestTask) {
        setToastFeedback(`🔔 Có nhiệm vụ mới được giao: "${latestTask.title.substring(0, 40)}..."`);
        setTimeout(() => setToastFeedback(null), 6000);
      }
    }
    prevTasksCountRef.current = tasks.length;
  }, [tasks]);

  const reminders = useMemo(() => {
    const items: ReminderItem[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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

    for (const docItem of documents) {
      if (!docItem.actionDeadline) continue;
      if (docItem.reminderEnabled === false) continue;
      const dueDateObj = parseDateString(docItem.actionDeadline);
      if (!dueDateObj) continue;

      const docDateAtMidnight = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());
      const diffTime = docDateAtMidnight.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

      const thresholdDays = docItem.reminderDaysBefore ?? 3;

      let urgency: DeadlineUrgency | null = null;
      if (diffDays < 0) {
        urgency = 'OVERDUE';
      } else if (diffDays === 0) {
        urgency = 'DUE_TODAY';
      } else if (diffDays <= thresholdDays) {
        urgency = 'DUE_SOON';
      }

      if (urgency) {
        const id = `doc-${docItem.id}`;
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

    return items.sort((a, b) => {
      const order = { OVERDUE: 0, DUE_TODAY: 1, DUE_SOON: 2 };
      if (order[a.urgency] !== order[b.urgency]) {
        return order[a.urgency] - order[b.urgency];
      }
      return a.daysDiff - b.daysDiff;
    });
  }, [tasks, documents, completedIds]);

  const activeReminders = useMemo(() => {
    return reminders.filter(r => !dismissedIds.has(r.id));
  }, [reminders, dismissedIds]);

  const filteredReminders = useMemo(() => {
    if (filterUrgency === 'ALL') return activeReminders;
    return activeReminders.filter(r => r.urgency === filterUrgency);
  }, [activeReminders, filterUrgency]);

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
    return null;
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
            className="fixed top-20 right-6 z-50 bg-slate-900 text-white border border-slate-700 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-xs font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{toastFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Flat Floating Toast Reminders Widget */}
      <div className="fixed bottom-5 right-5 z-40 max-w-sm w-full px-2 sm:px-0 pointer-events-none">
        <div className="pointer-events-auto space-y-3">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white text-slate-900 rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                    counts.overdue > 0 ? 'bg-red-600' : 'bg-blue-600'
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  {counts.total > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                      {counts.total}
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">Nhắc Nhở Deadline</h3>
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded">
                      Trực tuyến
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-normal">
                    {counts.overdue > 0 ? `${counts.overdue} việc đã quá hạn` : `${counts.total} công việc cần lưu ý`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="px-2 py-1 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-200/60 transition-colors text-xs font-medium"
                >
                  {isMinimized ? "Hiện" : "Ẩn"}
                </button>
                <button
                  onClick={handleDismissAll}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 transition-colors"
                  title="Đóng tất cả"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            {!isMinimized && (
              <div className="p-3 space-y-2.5">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[10px] font-semibold text-slate-600">
                  <button
                    onClick={() => setFilterUrgency('ALL')}
                    className={`flex-1 py-1 px-2 rounded transition-all ${
                      filterUrgency === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                    }`}
                  >
                    Tất cả ({counts.total})
                  </button>
                  {counts.overdue > 0 && (
                    <button
                      onClick={() => setFilterUrgency('OVERDUE')}
                      className={`py-1 px-2 rounded transition-all ${
                        filterUrgency === 'OVERDUE' ? 'bg-red-600 text-white shadow-2xs font-bold' : 'text-red-600 hover:text-red-700'
                      }`}
                    >
                      Quá hạn ({counts.overdue})
                    </button>
                  )}
                  {counts.dueToday > 0 && (
                    <button
                      onClick={() => setFilterUrgency('DUE_TODAY')}
                      className={`py-1 px-2 rounded transition-all ${
                        filterUrgency === 'DUE_TODAY' ? 'bg-amber-600 text-white shadow-2xs font-bold' : 'text-amber-700 hover:text-amber-800'
                      }`}
                    >
                      Hôm nay ({counts.dueToday})
                    </button>
                  )}
                  {counts.dueSoon > 0 && (
                    <button
                      onClick={() => setFilterUrgency('DUE_SOON')}
                      className={`py-1 px-2 rounded transition-all ${
                        filterUrgency === 'DUE_SOON' ? 'bg-blue-600 text-white shadow-2xs font-bold' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      Sắp tới ({counts.dueSoon})
                    </button>
                  )}
                </div>

                {/* Reminder Cards List */}
                <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                  <AnimatePresence>
                    {filteredReminders.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 italic">
                        Không có nhắc nhở nào theo bộ lọc.
                      </div>
                    ) : (
                      filteredReminders.map((item) => {
                        const isOverdue = item.urgency === 'OVERDUE';
                        const isToday = item.urgency === 'DUE_TODAY';

                        const badgeClass = isOverdue
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : isToday
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200';

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${badgeClass}`}>
                                  {isOverdue ? `Quá hạn ${Math.abs(item.daysDiff)} ngày` : isToday ? 'Đến hạn Hôm Nay' : `Còn ${item.daysDiff} ngày`}
                                </span>

                                {item.docNumber && (
                                  <span className="text-[9px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    {item.docNumber}
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() => handleDismiss(item.id)}
                                className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                              {item.title}
                            </h4>

                            <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                Hạn: <strong className="text-slate-800">{item.dueDateStr}</strong>
                              </span>

                              <div className="flex items-center gap-1.5">
                                {item.type === 'TASK' && (
                                  <button
                                    onClick={() => handleQuickCompleteTask(item)}
                                    disabled={completingId === item.id}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded transition-all flex items-center gap-1 text-[10px]"
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                    <span>Xong</span>
                                  </button>
                                )}

                                {item.sourceDocId ? (
                                  <Link
                                    to={`/documents/${item.sourceDocId}`}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-bold rounded transition-all flex items-center gap-1 text-[10px]"
                                  >
                                    <span>Chi tiết</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </Link>
                                ) : (
                                  <Link
                                    to="/tasks"
                                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded transition-all flex items-center gap-1 text-[10px]"
                                  >
                                    <span>Xem</span>
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

                {/* Footer */}
                <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Tự động nhắc nhở</span>
                  <Link
                    to="/tasks"
                    className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors text-xs"
                  >
                    <span>Quản lý nhiệm vụ</span>
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

export function TaskReminderAlertBanner({ tasks, documents = [] }: { tasks: Task[]; documents?: Document[] }) {
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
      className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
        reminderCounts.overdue > 0
          ? 'bg-red-50 text-red-900 border-red-200'
          : 'bg-amber-50 text-amber-900 border-amber-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white ${
          reminderCounts.overdue > 0 ? 'bg-red-600' : 'bg-amber-600'
        }`}>
          <AlertTriangle className="w-4 h-4" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black uppercase tracking-wide">
              {reminderCounts.overdue > 0 ? 'Cảnh báo: Có nhiệm vụ quá hạn xử lý' : 'Nhắc nhở: Nhiệm vụ sắp đến hạn'}
            </h4>
            {reminderCounts.overdue > 0 && (
              <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded">
                QUÁ HẠN
              </span>
            )}
          </div>

          <p className="text-xs text-slate-700 mt-0.5">
            {reminderCounts.overdue > 0 && <strong className="text-red-700 mr-1.5">• {reminderCounts.overdue} quá hạn.</strong>}
            {reminderCounts.dueToday > 0 && <span className="text-amber-800 font-semibold mr-1.5">• {reminderCounts.dueToday} đến hạn hôm nay.</span>}
            {reminderCounts.dueSoon > 0 && <span className="text-slate-600">• {reminderCounts.dueSoon} đến hạn trong 3 ngày tới.</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <Link
          to="/tasks"
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
        >
          <span>Xem & Xử lý</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}
