import { Document } from '../types';
import { Printer, X, Copy, Check, Sparkles, Building2, UserCheck, ShieldCheck, Clock } from 'lucide-react';
import { useState } from 'react';

interface DispatchSlipProps {
  document: Document;
  onClose?: () => void;
}

const PARTY_SECRETARY_ENDORSEMENT_TEMPLATES = [
  {
    id: 'tmpl-1',
    label: 'Chỉ đạo Thường trực / Ban Thường vụ',
    text: 'Giao Văn phòng Đảng ủy chuẩn bị nội dung đưa vào Chương trình họp Ban Thường vụ Đảng ủy phường gần nhất để xem xét, thảo luận và cho ý kiến chỉ đạo.'
  },
  {
    id: 'tmpl-2',
    label: 'Giao UBND Phường thực hiện',
    text: 'Đồng ý về mặt chủ trương. Giao Ủy ban nhân dân phường tổ chức triển khai thực hiện, bảo đảm tiến độ, đúng quy định pháp luật và định kỳ báo cáo Thường trực Đảng ủy.'
  },
  {
    id: 'tmpl-3',
    label: 'Giao Khối Dân vận - Mặt trận - Đoàn thể',
    text: 'Giao Khối Dân vận chỉ đạo Mặt trận Tổ quốc và các tổ chức chính trị - xã hội phường tăng cường công tác tuyên truyền, vận động nhân dân đồng thuận, tự giác hưởng ứng.'
  },
  {
    id: 'tmpl-4',
    label: 'Giao Chi bộ Khu phố nắm chắc địa bàn',
    text: 'Giao Cấp ủy Chi bộ khu phố tổ chức họp phân công đảng viên nòng cốt bám sát địa bàn, kịp thời nắm bắt tâm tư nhân dân và báo cáo Thường trực Đảng ủy các vấn đề phát sinh.'
  }
];

export default function DispatchSlip({ document, onClose }: DispatchSlipProps) {
  const [copied, setCopied] = useState(false);
  const [secretaryEndorsement, setSecretaryEndorsement] = useState<string>(
    document.advisoryOpinion 
      ? `Đồng ý theo đề xuất của Văn phòng. ${document.advisoryOpinion}`
      : 'Đồng ý chủ trương. Giao UBND phường chủ trì phối hợp với các đơn vị liên quan tổ chức triển khai thực hiện, bảo đảm tiến độ.'
  );

  const handlePrint = () => {
    window.print();
  };

  const handleApplyTemplate = (text: string) => {
    setSecretaryEndorsement(text);
  };

  const handleCopyText = () => {
    const text = `
ĐẢNG BỘ PHƯỜNG ...
BAN CHẤP HÀNH ĐẢNG BỘ PHƯỜNG
-----------------------------------------
PHIẾU TRÌNH VĂN BẢN & Ý KIẾN BÚT PHÊ CỦA BÍ THƯ ĐẢNG UỶ PHƯỜNG

1. THÔNG TIN VĂN BẢN ĐẾN:
- Số/Ký hiệu: ${document.documentNumber || 'Chưa rõ'}
- Cơ quan ban hành: ${document.issuer || 'N/A'}
- Ngày ban hành: ${document.issuedDate || 'N/A'}
- Trích yếu: ${document.title || document.fileName}
- Độ khẩn: ${document.urgency || 'Thường'} | Độ mật: ${document.confidentiality || 'Thường'}

2. ĐỀ XUẤT PHÂN LUỒNG XỬ LÝ CỦA VĂN PHÒNG CẤP ỦY:
- Hướng xử lý: ${document.proposedAction || 'Báo cáo Thường trực Đảng ủy xem xét cho chủ trương'}
- Đơn vị chủ trì: ${document.leadDepartment || 'Văn phòng Đảng ủy'}
- Đơn vị phối hợp: ${(document.coordinatingDepartments || []).join(', ') || 'UBND phường, Khối Dân vận'}
- Thời hạn báo cáo: ${document.actionDeadline || 'Theo quy chế'}

3. Ý KIẾN THAM MƯU CỦA VĂN PHÒNG CẤP ỦY:
${document.advisoryOpinion || document.summary || 'Kính trình Bí thư Đảng ủy xem xét cho ý kiến chỉ đạo.'}

4. BÚT PHÊ CHỈ ĐẠO CỦA BÍ THƯ ĐẢNG UỶ PHƯỜNG:
"${secretaryEndorsement}"
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-blue-950/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-blue-800 flex items-center justify-between bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-amber-300 font-bold border border-blue-400">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white">Phiếu Trình & Ý Kiến Bút Phê Chỉ Đạo Của Bí Thư Đảng Ủy</h2>
              <p className="text-[11px] text-blue-200/80">Chuẩn thể thức văn bản Đảng • Quyết định 353-QĐ/TW</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-3 py-1.5 bg-blue-800/90 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-600/60"
              title="Sao chép toàn bộ phiếu trình"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép phiếu'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Phiếu Trình</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/80 transition-colors ml-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Scroll Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">

          {/* Quick Endorsement Selector for Secretary (Interactive controls, hidden when printing) */}
          <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-3 no-print">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black uppercase text-blue-900 tracking-wider">
                  Mẫu Bút Phê Chuẩn Của Bí Thư Đảng Ủy
                </span>
              </div>
              <span className="text-[10px] text-blue-600 font-bold">Nhấp chọn mẫu để nạp nhanh</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PARTY_SECRETARY_ENDORSEMENT_TEMPLATES.map(tmpl => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl.text)}
                  className="p-2.5 bg-white hover:bg-blue-100/60 border border-blue-200/80 hover:border-blue-400 rounded-xl text-left text-xs transition-all shadow-2xs group cursor-pointer"
                >
                  <div className="font-bold text-blue-950 text-[11px] group-hover:text-blue-700 flex items-center gap-1">
                    <span>{tmpl.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 italic line-clamp-1 mt-0.5">"{tmpl.text}"</p>
                </button>
              ))}
            </div>

            <div className="space-y-1 pt-1">
              <label htmlFor="secretary-custom-endorsement" className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Ý kiến bút phê chỉ đạo trực tiếp của Bí thư:
              </label>
              <textarea
                id="secretary-custom-endorsement"
                value={secretaryEndorsement}
                onChange={(e) => setSecretaryEndorsement(e.target.value)}
                rows={3}
                className="w-full p-3 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-blue-950 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none leading-relaxed"
                placeholder="Nhập ý kiến chỉ đạo trực tiếp của Bí thư Đảng ủy..."
              />
            </div>
          </div>

          {/* Printable Official Document Content */}
          <div id="printable-dispatch-slip" className="text-slate-900 bg-white leading-relaxed font-sans">
            
            {/* Header standard */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
              <div className="text-center font-semibold text-xs space-y-1">
                <div className="uppercase font-bold tracking-wider text-slate-900">ĐẢNG BỘ PHƯỜNG ...</div>
                <div className="uppercase font-extrabold text-blue-950 tracking-wide text-[11px]">BAN CHẤP HÀNH ĐẢNG BỘ</div>
                <div className="text-slate-600 italic text-[10px]">Văn phòng Đảng ủy</div>
              </div>
              <div className="text-center font-sans text-xs space-y-1">
                <div className="uppercase font-bold tracking-wider text-slate-900">ĐẢNG CỘNG SẢN VIỆT NAM</div>
                <div className="font-semibold text-slate-700 text-[11px]">Cơ quan Cấp ủy Địa phương</div>
                <div className="text-[10px] text-slate-500 italic">..., ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</div>
              </div>
            </div>

            <div className="text-center my-6">
              <h1 className="font-sans font-black text-lg md:text-xl text-blue-950 uppercase tracking-wide">
                PHIẾU TRÌNH VĂN BẢN & Ý KIẾN BÚT PHÊ
              </h1>
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider mt-0.5">
                CỦA BÍ THƯ ĐẢNG UỶ PHƯỜNG
              </p>
            </div>

            {/* Metadata Table */}
            <table className="w-full border-collapse border border-slate-400 text-xs font-sans mb-6">
              <tbody>
                <tr>
                  <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold w-1/4">Số / Ký hiệu văn bản:</td>
                  <td className="border border-slate-300 p-2.5 font-bold text-blue-950">{document.documentNumber || 'Chưa cập nhật'}</td>
                  <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold w-1/4">Ngày ban hành:</td>
                  <td className="border border-slate-300 p-2.5">{document.issuedDate || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold">Cơ quan ban hành:</td>
                  <td className="border border-slate-300 p-2.5 font-semibold text-slate-900" colSpan={3}>{document.issuer || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold">Trích yếu nội dung:</td>
                  <td className="border border-slate-300 p-2.5 font-black text-slate-950" colSpan={3}>{document.title || document.fileName}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold">Độ khẩn / Độ mật:</td>
                  <td className="border border-slate-300 p-2.5">
                    <span className="font-bold text-red-600">{document.urgency || 'Thường'}</span> / {document.confidentiality || 'Thường'}
                  </td>
                  <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold">Hạn hoàn thành chỉ đạo:</td>
                  <td className="border border-slate-300 p-2.5 font-bold text-red-700">{document.actionDeadline || 'Theo quy chế làm việc'}</td>
                </tr>
              </tbody>
            </table>

            {/* Section 1: Executive Routing */}
            <div className="space-y-4 font-sans text-xs mb-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="font-black uppercase tracking-wider text-blue-950 text-xs mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  1. Đề xuất Phân luồng Cấp ủy & Đơn vị Chủ trì Thực hiện
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-slate-800">
                  <div>
                    <span className="font-bold text-slate-600">Hướng chỉ đạo phân luồng:</span>
                    <p className="font-black text-red-700 mt-0.5">{document.proposedAction || 'Báo cáo Thường trực Đảng ủy xem xét cho chủ trương'}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-600">Cơ quan / Ban ngành chủ trì:</span>
                    <p className="font-bold text-blue-950 mt-0.5">{document.leadDepartment || 'Văn phòng Đảng ủy'}</p>
                  </div>
                  {document.coordinatingDepartments && document.coordinatingDepartments.length > 0 && (
                    <div className="md:col-span-2">
                      <span className="font-bold text-slate-600">Đơn vị phối hợp thực hiện:</span>
                      <p className="font-semibold text-slate-800 mt-0.5">{document.coordinatingDepartments.join(', ')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Office Advisory Opinion */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="font-black uppercase tracking-wider text-blue-950 text-xs mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                  2. Ý kiến Tham mưu của Văn phòng Cấp ủy
                </h3>
                <p className="text-slate-900 leading-relaxed font-semibold bg-white p-3.5 rounded-xl border border-slate-200 whitespace-pre-line italic">
                  "{document.advisoryOpinion || document.summary || 'Kính trình Bí thư Đảng ủy xem xét, cho ý kiến chỉ đạo triển khai thực hiện.'}"
                </p>
              </div>

              {/* Section 3: Bí thư Party Secretary Endorsement */}
              <div className="p-4 rounded-xl bg-blue-50/80 border-2 border-blue-600/60 shadow-xs">
                <h3 className="font-black uppercase tracking-wider text-blue-950 text-xs mb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                  3. Ý Kiến Bút Phê Chỉ Đạo Trực Tiếp Của Bí Thư Đảng Ủy Phường
                </h3>
                <p className="text-blue-950 font-black text-sm leading-relaxed bg-white p-4 rounded-xl border border-blue-300 shadow-2xs whitespace-pre-line">
                  "{secretaryEndorsement}"
                </p>
              </div>
            </div>

            {/* Signature Box Section */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 font-sans text-xs text-center">
              <div>
                <div className="font-bold uppercase text-slate-900">VĂN PHÒNG ĐẢNG UỶ</div>
                <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên)</div>
                <div className="h-20 flex items-center justify-center font-bold text-slate-400 italic">
                  [Đã thẩm định & trình]
                </div>
              </div>
              <div>
                <div className="font-black uppercase text-blue-950 text-sm">BÍ THƯ ĐẢNG UỶ PHƯỜNG</div>
                <div className="text-[11px] text-slate-500 italic mt-0.5">(Đã duyệt & ký phê duyệt điện tử)</div>
                <div className="h-20 flex items-center justify-center">
                  <div className="p-2 border-2 border-red-600/80 text-red-700 font-black text-xs uppercase tracking-widest rounded-lg rotate-[-3deg] bg-red-50/50">
                    ✓ ĐÃ BÚT PHÊ PHÊ DUYỆT
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

