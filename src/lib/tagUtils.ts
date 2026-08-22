import { Document } from '../types';

export const STANDARD_TAGS = [
  'Yêu cầu báo cáo',
  'Kiểm tra - Giám sát',
  'Xây dựng kế hoạch',
  'Nghị quyết',
  'Chỉ thị',
  'Quyết định',
  'Tờ trình',
  'Thông báo',
  'Tài chính - Ngân sách',
  'Tổ chức - Cán bộ',
  'Đô thị - Môi trường',
  'An ninh - Quốc phòng',
  'Chuyển đổi số',
] as const;

export function getDocumentTags(docItem: Partial<Document>): string[] {
  const existingTags = docItem.tags && docItem.tags.length > 0 ? docItem.tags : [];
  const inferred = new Set<string>(existingTags);

  const textToSearch = [
    docItem.title || '',
    docItem.documentType || '',
    docItem.summary || '',
    docItem.proposedAction || '',
    docItem.leadDepartment || '',
    (docItem.keyDirectives || []).join(' '),
    (docItem.requirements || []).join(' '),
    docItem.fullContent || '',
  ].join(' ').toLowerCase();

  // 1. Yêu cầu báo cáo
  if (
    textToSearch.includes('báo cáo') ||
    textToSearch.includes('yêu cầu báo cáo') ||
    textToSearch.includes('hạn báo cáo') ||
    textToSearch.includes('đề xuất báo cáo') ||
    (docItem.actionDeadline && docItem.actionDeadline.length > 0)
  ) {
    inferred.add('Yêu cầu báo cáo');
  }

  // 2. Kiểm tra - Giám sát
  if (
    textToSearch.includes('kiểm tra') ||
    textToSearch.includes('giám sát') ||
    textToSearch.includes('thanh tra') ||
    textToSearch.includes('đôn đốc') ||
    textToSearch.includes('rà soát')
  ) {
    inferred.add('Kiểm tra - Giám sát');
  }

  // 3. Xây dựng kế hoạch
  if (
    textToSearch.includes('kế hoạch') ||
    textToSearch.includes('xây dựng kế hoạch') ||
    textToSearch.includes('phương án') ||
    textToSearch.includes('đề án') ||
    docItem.suggestedDraftType?.toLowerCase().includes('kế hoạch')
  ) {
    inferred.add('Xây dựng kế hoạch');
  }

  // 4. Nghị quyết
  if (
    textToSearch.includes('nghị quyết') ||
    docItem.documentType?.toLowerCase().includes('nghị quyết')
  ) {
    inferred.add('Nghị quyết');
  }

  // 5. Chỉ thị
  if (
    textToSearch.includes('chỉ thị') ||
    docItem.documentType?.toLowerCase().includes('chỉ thị')
  ) {
    inferred.add('Chỉ thị');
  }

  // 6. Quyết định
  if (
    textToSearch.includes('quyết định') ||
    docItem.documentType?.toLowerCase().includes('quyết định')
  ) {
    inferred.add('Quyết định');
  }

  // 7. Tờ trình
  if (
    textToSearch.includes('tờ trình') ||
    docItem.documentType?.toLowerCase().includes('tờ trình')
  ) {
    inferred.add('Tờ trình');
  }

  // 8. Tài chính - Ngân sách
  if (
    textToSearch.includes('tài chính') ||
    textToSearch.includes('ngân sách') ||
    textToSearch.includes('kinh phí') ||
    textToSearch.includes('đầu tư') ||
    textToSearch.includes('chi phí')
  ) {
    inferred.add('Tài chính - Ngân sách');
  }

  // 9. Tổ chức - Cán bộ
  if (
    textToSearch.includes('cán bộ') ||
    textToSearch.includes('nhân sự') ||
    textToSearch.includes('tổ chức') ||
    textToSearch.includes('bổ nhiệm') ||
    textToSearch.includes('quy hoạch')
  ) {
    inferred.add('Tổ chức - Cán bộ');
  }

  // 10. Đô thị - Môi trường
  if (
    textToSearch.includes('đô thị') ||
    textToSearch.includes('môi trường') ||
    textToSearch.includes('đất đai') ||
    textToSearch.includes('vỉa hè') ||
    textToSearch.includes('xây dựng')
  ) {
    inferred.add('Đô thị - Môi trường');
  }

  // 11. An ninh - Quốc phòng
  if (
    textToSearch.includes('an ninh') ||
    textToSearch.includes('quốc phòng') ||
    textToSearch.includes('công an') ||
    textToSearch.includes('pccc') ||
    textToSearch.includes('trật tự')
  ) {
    inferred.add('An ninh - Quốc phòng');
  }

  // 12. Chuyển đổi số
  if (
    textToSearch.includes('chuyển đổi số') ||
    textToSearch.includes('cntt') ||
    textToSearch.includes('máy tính') ||
    textToSearch.includes('dịch vụ công') ||
    textToSearch.includes('phần mềm')
  ) {
    inferred.add('Chuyển đổi số');
  }

  return Array.from(inferred);
}

export function getTagStyle(tag: string): { bgClass: string; icon: string } {
  const normalized = tag.toLowerCase();

  let icon = '•';
  if (normalized.includes('báo cáo')) icon = '📋';
  else if (normalized.includes('kiểm tra') || normalized.includes('giám sát')) icon = '🔍';
  else if (normalized.includes('kế hoạch')) icon = '📅';
  else if (normalized.includes('nghị quyết')) icon = '🏛️';
  else if (normalized.includes('chỉ thị')) icon = '⚡';
  else if (normalized.includes('quyết định')) icon = '⚖️';
  else if (normalized.includes('tờ trình')) icon = '📄';
  else if (normalized.includes('tài chính') || normalized.includes('ngân sách')) icon = '💰';
  else if (normalized.includes('cán bộ') || normalized.includes('tổ chức')) icon = '👥';
  else if (normalized.includes('đô thị') || normalized.includes('môi trường')) icon = '🌱';
  else if (normalized.includes('an ninh') || normalized.includes('quốc phòng')) icon = '🛡️';
  else if (normalized.includes('chuyển đổi số')) icon = '💻';

  return { 
    bgClass: 'bg-slate-100 text-slate-700 border border-slate-200/80 font-medium hover:bg-slate-200 transition-colors', 
    icon 
  };
}
