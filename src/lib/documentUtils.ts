import { Document } from '../types';

export interface DocumentProgressStatus {
  type: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'IN_TIME' | 'NO_DEADLINE';
  label: string;
  badgeClass: string;
  daysDiff: number | null;
  deadlineText: string;
}

export function parseDateString(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const str = dateStr.trim();
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    return new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
  }
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    return new Date(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function getDocumentProgressStatus(docItem: Partial<Document>): DocumentProgressStatus {
  const deadlineStr = docItem.actionDeadline || (docItem.deadlines && docItem.deadlines[0]);
  if (!deadlineStr) {
    return {
      type: 'NO_DEADLINE',
      label: 'Theo quy chế',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
      daysDiff: null,
      deadlineText: 'Theo quy chế'
    };
  }

  const d = parseDateString(deadlineStr);
  if (!d) {
    return {
      type: 'IN_TIME',
      label: deadlineStr,
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
      daysDiff: null,
      deadlineText: deadlineStr
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const docDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffTime = docDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays < 0) {
    return {
      type: 'OVERDUE',
      label: `🔴 Quá hạn ${Math.abs(diffDays)} ngày`,
      badgeClass: 'bg-red-50 text-red-700 border-red-200 font-black shadow-2xs',
      daysDiff: diffDays,
      deadlineText: deadlineStr
    };
  } else if (diffDays === 0) {
    return {
      type: 'DUE_TODAY',
      label: '🟠 Đến hạn hôm nay',
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 font-black shadow-2xs',
      daysDiff: 0,
      deadlineText: deadlineStr
    };
  } else if (diffDays <= 3) {
    return {
      type: 'DUE_SOON',
      label: `🟡 Còn ${diffDays} ngày`,
      badgeClass: 'bg-yellow-50 text-yellow-900 border-yellow-300 font-bold',
      daysDiff: diffDays,
      deadlineText: deadlineStr
    };
  } else {
    return {
      type: 'IN_TIME',
      label: `🟢 Trong hạn (${diffDays}d)`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
      daysDiff: diffDays,
      deadlineText: deadlineStr
    };
  }
}

export function isUrgentDocument(doc: Partial<Document>): boolean {
  return !!(doc.urgency && doc.urgency !== 'Thường');
}
