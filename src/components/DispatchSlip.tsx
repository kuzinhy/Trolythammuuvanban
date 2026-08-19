import { Document } from '../types';
import { Printer, X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface DispatchSlipProps {
  document: Document;
  onClose?: () => void;
}

export default function DispatchSlip({ document, onClose }: DispatchSlipProps) {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const text = `
PHIẾU TRÌNH / XỬ LÝ VĂN BẢN
-----------------------------------------
1. VĂN BẢN ĐẾN:
- Số/Ký hiệu: ${document.documentNumber || 'Chưa rõ'}
- Cơ quan ban hành: ${document.issuer || 'N/A'}
- Ngày ban hành: ${document.issuedDate || 'N/A'}
- Trích yếu: ${document.title || document.fileName}
- Độ khẩn: ${document.urgency || 'Thường'} | Độ mật: ${document.confidentiality || 'Thường'}

2. ĐỀ XUẤT PHÂN LUỒNG XỬ LÝ:
- Hướng xử lý: ${document.proposedAction || 'Báo cáo Thường trực / Lãnh đạo'}
- Đơn vị chủ trì: ${document.leadDepartment || 'Văn phòng'}
- Đơn vị phối hợp: ${(document.coordinatingDepartments || []).join(', ') || 'Các cơ quan, ban ngành liên quan'}
- Thời hạn báo cáo: ${document.actionDeadline || 'Theo quy định'}

3. Ý KIẾN THAM MƯU CỦA VĂN PHÒNG:
${document.advisoryOpinion || document.summary || 'Kính trình Lãnh đạo xem xét cho ý kiến chỉ đạo.'}

4. CÁC NỘI DUNG CHỈ ĐẠO TRỌNG TÂM:
${(document.keyDirectives || []).map((k, i) => `${i + 1}. ${k}`).join('\n') || 'Không có ghi chú cụ thể.'}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header (Hidden when printing) */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white no-print">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span>Phiếu Trình & Xử lý Văn bản Điện tử</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Sao chép nội dung phiếu"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Phiếu Trình</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Printable Dispatch Slip Content */}
        <div id="printable-dispatch-slip" className="flex-1 overflow-y-auto p-8 font-serif text-slate-900 bg-white leading-relaxed">
          {/* Header standard */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
            <div className="text-center font-sans font-semibold text-xs space-y-1">
              <div className="uppercase font-bold tracking-wider">VĂN PHÒNG CẤP ỦY / CHÍNH QUYỀN</div>
              <div className="text-slate-600 font-serif italic">Bộ phận Tham mưu - Tổng hợp</div>
            </div>
            <div className="text-center font-sans text-xs space-y-1">
              <div className="uppercase font-bold tracking-wider text-slate-900">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div className="font-semibold text-slate-700 text-[11px]">Độc lập - Tự do - Hạnh phúc</div>
              <div className="text-[10px] text-slate-500 italic">..., ngày ... tháng ... năm 202...</div>
            </div>
          </div>

          <div className="text-center my-6">
            <h1 className="font-sans font-black text-xl text-slate-950 uppercase tracking-wide">
              PHIẾU TRÌNH XỬ LÝ VĂN BẢN ĐẾN
            </h1>
            <p className="text-xs font-sans text-slate-500 italic mt-1">
              (Hệ thống Trợ lý AI Tham mưu & Tổng hợp tự động)
            </p>
          </div>

          {/* Metadata Table */}
          <table className="w-full border-collapse border border-slate-400 text-xs font-sans mb-6">
            <tbody>
              <tr>
                <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold w-1/4">Số / Ký hiệu:</td>
                <td className="border border-slate-300 p-2.5 font-semibold text-slate-900">{document.documentNumber || 'Chưa cập nhật'}</td>
                <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold w-1/4">Ngày văn bản:</td>
                <td className="border border-slate-300 p-2.5">{document.issuedDate || 'N/A'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold">Cơ quan gửi:</td>
                <td className="border border-slate-300 p-2.5 font-semibold" colSpan={3}>{document.issuer || 'N/A'}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold">Trích yếu:</td>
                <td className="border border-slate-300 p-2.5 font-bold text-slate-900" colSpan={3}>{document.title || document.fileName}</td>
              </tr>
              <tr>
                <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold">Mức độ khẩn / mật:</td>
                <td className="border border-slate-300 p-2.5">
                  <span className="font-bold text-red-600">{document.urgency || 'Thường'}</span> / {document.confidentiality || 'Thường'}
                </td>
                <td className="border border-slate-300 p-2.5 bg-slate-50 font-bold">Hạn xử lý đề xuất:</td>
                <td className="border border-slate-300 p-2.5 font-bold text-red-700">{document.actionDeadline || 'Theo quy chế'}</td>
              </tr>
            </tbody>
          </table>

          {/* Section 1: Executive Routing */}
          <div className="space-y-4 font-sans text-xs mb-6">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <h3 className="font-bold uppercase tracking-wider text-slate-900 text-xs mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                1. Đề xuất Phân luồng Thẩm quyền & Cơ quan Tham mưu
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-slate-800">
                <div>
                  <span className="font-semibold text-slate-600">Phân luồng chính:</span>
                  <p className="font-bold text-red-700 mt-0.5">{document.proposedAction || 'Báo cáo Lãnh đạo cho chủ trương'}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Cơ quan chủ trì tham mưu:</span>
                  <p className="font-bold text-slate-900 mt-0.5">{document.leadDepartment || 'Văn phòng'}</p>
                </div>
                {document.coordinatingDepartments && document.coordinatingDepartments.length > 0 && (
                  <div className="md:col-span-2">
                    <span className="font-semibold text-slate-600">Cơ quan / Ban ngành phối hợp:</span>
                    <p className="font-medium text-slate-800 mt-0.5">{document.coordinatingDepartments.join(', ')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Advisory Opinion */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <h3 className="font-bold uppercase tracking-wider text-slate-900 text-xs mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                2. Ý kiến Tham mưu & Đề xuất của Chuyên viên / Văn phòng
              </h3>
              <p className="text-slate-800 leading-relaxed italic bg-white p-3 rounded border border-slate-200 whitespace-pre-line font-serif">
                "{document.advisoryOpinion || document.summary || 'Kính trình Lãnh đạo xem xét cho ý kiến chỉ đạo triển khai thực hiện.'}"
              </p>
            </div>

            {/* Section 3: Key Directives */}
            {document.keyDirectives && document.keyDirectives.length > 0 && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h3 className="font-bold uppercase tracking-wider text-slate-900 text-xs mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  3. Các Yêu cầu Trọng tâm / Nhiệm vụ Cần Thực hiện
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-800">
                  {document.keyDirectives.map((item, idx) => (
                    <li key={idx} className="leading-snug">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Signature Box Section */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 font-sans text-xs text-center">
            <div>
              <div className="font-bold uppercase text-slate-900">CHUYÊN VIÊN THAM MƯU</div>
              <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</div>
              <div className="h-20"></div>
            </div>
            <div>
              <div className="font-bold uppercase text-slate-900">Ý KIẾN CHỈ ĐẠO CỦA LÃNH ĐẠO</div>
              <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký, ghi ý kiến và họ tên)</div>
              <div className="h-20 border-b border-dashed border-slate-300"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
