import { Document } from '../types';

export interface DocumentProgressStatus {
  type: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'IN_TIME' | 'NO_DEADLINE';
  label: string;
  badgeClass: string;
  daysDiff: number | null;
  deadlineText: string;
}

export interface DocumentTypeOption {
  value: string;
  label: string;
  shortLabel: string;
  colorClass: string;
  keywords: string[];
}

export const ADMINISTRATIVE_DOC_TYPES: DocumentTypeOption[] = [
  { value: 'ALL', label: 'Tất cả loại văn bản', shortLabel: 'Tất cả loại', colorClass: 'bg-slate-100 text-slate-800', keywords: [] },
  { value: 'NGHI_QUYET', label: 'Nghị quyết (Đảng ủy / HĐND)', shortLabel: 'Nghị quyết', colorClass: 'bg-red-50 text-red-700 border-red-200', keywords: ['nghị quyết', 'nghi quyet', 'nq'] },
  { value: 'QUYET_DINH', label: 'Quyết định (UBND / Đảng ủy)', shortLabel: 'Quyết định', colorClass: 'bg-amber-50 text-amber-800 border-amber-200', keywords: ['quyết định', 'quyet dinh', 'qđ', 'qd'] },
  { value: 'CHI_THI', label: 'Chỉ thị', shortLabel: 'Chỉ thị', colorClass: 'bg-rose-50 text-rose-700 border-rose-200', keywords: ['chỉ thị', 'chi thi', 'ct'] },
  { value: 'KET_LUAN', label: 'Kết luận / Thông báo kết luận', shortLabel: 'Kết luận', colorClass: 'bg-purple-50 text-purple-700 border-purple-200', keywords: ['kết luận', 'ket luan', 'thông báo kết luận', 'tbkl', 'kl'] },
  { value: 'THONG_BAO', label: 'Thông báo', shortLabel: 'Thông báo', colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200', keywords: ['thông báo', 'thong bao', 'tb'] },
  { value: 'CONG_VAN', label: 'Công văn / Công văn chỉ đạo', shortLabel: 'Công văn', colorClass: 'bg-blue-50 text-blue-700 border-blue-200', keywords: ['công văn', 'cong van', 'cv'] },
  { value: 'TO_TRINH', label: 'Tờ trình', shortLabel: 'Tờ trình', colorClass: 'bg-teal-50 text-teal-700 border-teal-200', keywords: ['tờ trình', 'to trinh', 'ttr'] },
  { value: 'BAO_CAO', label: 'Báo cáo', shortLabel: 'Báo cáo', colorClass: 'bg-cyan-50 text-cyan-700 border-cyan-200', keywords: ['báo cáo', 'bao cao', 'bc'] },
  { value: 'KE_HOACH', label: 'Kế hoạch / Chương trình', shortLabel: 'Kế hoạch', colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', keywords: ['kế hoạch', 'ke hoach', 'kh', 'chương trình', 'ctr'] },
  { value: 'QUY_CHE', label: 'Quy chế / Quy định', shortLabel: 'Quy chế/QĐ', colorClass: 'bg-orange-50 text-orange-700 border-orange-200', keywords: ['quy chế', 'quy che', 'qc', 'quy định', 'quy dinh'] },
  { value: 'HUONG_DAN', label: 'Hướng dẫn', shortLabel: 'Hướng dẫn', colorClass: 'bg-violet-50 text-violet-700 border-violet-200', keywords: ['hướng dẫn', 'huong dan', 'hd'] },
  { value: 'TAI_LIEU_THAM_KHAO', label: 'Tài liệu tra cứu / Tham khảo', shortLabel: 'Tra cứu', colorClass: 'bg-stone-100 text-stone-700 border-stone-200', keywords: ['tra cứu', 'tham khảo', 'pháp lý', 'quy chuẩn', 'tài liệu'] },
];

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

export function formatDateToYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateToDMY(dateStr: string | null | undefined): string {
  const d = parseDateString(dateStr);
  if (!d) return dateStr || '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function extractDocumentDates(doc: Partial<Document>): {
  issuedDate: Date | null;
  receivedDate: Date | null;
  createdDate: Date | null;
  deadlineDate: Date | null;
  allDates: Date[];
} {
  const issued = parseDateString(doc.issuedDate);
  const received = parseDateString(doc.receivedDate);
  
  let created: Date | null = null;
  if (doc.createdAt) {
    if (typeof doc.createdAt.toDate === 'function') {
      created = doc.createdAt.toDate();
    } else if (doc.createdAt instanceof Date) {
      created = doc.createdAt;
    } else {
      created = parseDateString(String(doc.createdAt));
    }
  }
  if (!created && doc.createdTime) {
    created = parseDateString(doc.createdTime);
  }

  const deadline = parseDateString(doc.actionDeadline || (doc.deadlines && doc.deadlines[0]));

  const allDates = [issued, received, created, deadline].filter((d): d is Date => d !== null);

  return {
    issuedDate: issued,
    receivedDate: received,
    createdDate: created,
    deadlineDate: deadline,
    allDates
  };
}

export function matchDocumentDateRange(
  doc: Partial<Document>,
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined,
  dateFieldType: 'ALL' | 'ISSUED_DATE' | 'RECEIVED_OR_CREATED' | 'DEADLINE' = 'ALL'
): boolean {
  if (!startDateStr && !endDateStr) return true;

  const startDate = startDateStr ? parseDateString(startDateStr) : null;
  const endDate = endDateStr ? parseDateString(endDateStr) : null;

  if (startDate) {
    startDate.setHours(0, 0, 0, 0);
  }
  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
  }

  const dates = extractDocumentDates(doc);

  let targetDatesToCheck: Date[] = [];
  if (dateFieldType === 'ISSUED_DATE') {
    if (dates.issuedDate) targetDatesToCheck = [dates.issuedDate];
  } else if (dateFieldType === 'RECEIVED_OR_CREATED') {
    targetDatesToCheck = [dates.receivedDate, dates.createdDate].filter((d): d is Date => d !== null);
  } else if (dateFieldType === 'DEADLINE') {
    if (dates.deadlineDate) targetDatesToCheck = [dates.deadlineDate];
  } else {
    targetDatesToCheck = dates.allDates;
  }

  if (targetDatesToCheck.length === 0) {
    return false;
  }

  return targetDatesToCheck.some(targetDate => {
    const time = targetDate.getTime();
    if (startDate && time < startDate.getTime()) return false;
    if (endDate && time > endDate.getTime()) return false;
    return true;
  });
}

export function matchDocumentType(doc: Partial<Document>, typeValue: string): boolean {
  if (!typeValue || typeValue === 'ALL') return true;
  
  if (typeValue === 'TAI_LIEU_THAM_KHAO') {
    return !!(
      doc.isReferenceDoc ||
      (doc.tags || []).includes('TRA_CUU_THAM_KHAO') ||
      (doc.tags || []).includes('Văn bản tra cứu') ||
      doc.referenceCategory
    );
  }

  const option = ADMINISTRATIVE_DOC_TYPES.find(opt => opt.value === typeValue);
  if (!option) return true;

  const docType = (doc.documentType || '').toLowerCase().trim();
  const title = (doc.title || '').toLowerCase().trim();
  const fileName = (doc.fileName || '').toLowerCase().trim();
  const suggestedDraft = (doc.suggestedDraftType || '').toLowerCase().trim();

  return option.keywords.some(kw => 
    docType.includes(kw) ||
    title.includes(kw) ||
    fileName.includes(kw) ||
    suggestedDraft.includes(kw)
  );
}

export function isDocumentCompleted(docItem: Partial<Document>): boolean {
  if (!docItem) return false;
  const procResult = String(docItem.processingResult || '').toUpperCase();
  const docStatus = String(docItem.status || '').toUpperCase();
  return (
    procResult === 'COMPLETED' || 
    procResult === 'ĐÃ HOÀN THÀNH' || 
    procResult === 'HOÀN THÀNH' || 
    procResult === 'ĐÃ XỬ LÝ' ||
    procResult === 'PROCESSED' ||
    procResult === 'DISPATCHED' ||
    docStatus === 'COMPLETED' ||
    docStatus === 'PROCESSED' ||
    docStatus === 'ĐÃ XỬ LÝ' ||
    docStatus === 'DISPATCHED' ||
    !!docItem.isProcessed
  );
}

export function getDocumentProgressStatus(docItem: Partial<Document>): DocumentProgressStatus {
  const isCompleted = isDocumentCompleted(docItem);

  if (isCompleted) {
    return {
      type: 'IN_TIME',
      label: 'Đã hoàn thành',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold',
      daysDiff: null,
      deadlineText: docItem.actionDeadline || 'Đã xong'
    };
  }

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
  if (isDocumentCompleted(doc)) return false;
  return !!(doc.urgency && doc.urgency !== 'Thường');
}
