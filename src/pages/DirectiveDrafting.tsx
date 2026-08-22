import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  Sparkles, Loader2, Copy, Check, BookOpen, ThumbsUp, AlertCircle, 
  FileText, CheckCircle2, Trash2, Search, RotateCcw, ClipboardCheck, ArrowUpRight, X,
  ShieldCheck, History
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuthStore } from '../store/authStore';

interface DraftResult {
  option1: string;
  option2: string;
  styleDescription1: string;
  styleDescription2: string;
}

interface DraftVersionSnapshot {
  id: string;
  title: string;
  content: string;
  style: string;
  timestamp: string;
}

interface DirectiveHistoryItem {
  id: string;
  idea: string;
  selectedOptionText: string;
  style: string;
  createdAt: any;
}

interface Resolution {
  id: string;
  code: string;
  title: string;
  governingBody: string;
  keyKeywords: string[];
  coreContent: string;
}

interface HotSpot {
  id: string;
  title: string;
  location: string;
  ideaTemplate: string;
}

const DOCUMENT_TYPES = [
  { id: 'CONCLUSION', label: 'Thông báo Kết luận', desc: 'Kết luận họp Thường trực / Ban Thường vụ Đảng ủy' },
  { id: 'DIRECTIVE', label: 'Chỉ thị Cấp ủy', desc: 'Chỉ thị của Đảng ủy / Ban Thường vụ về nhiệm vụ trọng tâm' },
  { id: 'RESOLUTION', label: 'Nghị quyết Chuyên đề', desc: 'Nghị quyết chuyên đề của Đảng ủy chỉ đạo chính quyền & chi bộ' },
  { id: 'ENDORSEMENT', label: 'Ý kiến Bút phê', desc: 'Bút phê chỉ đạo trực tiếp phân luồng xử lý văn bản đến' },
];

const WARD_HOTSPOTS: HotSpot[] = [
  {
    id: 'spot-1',
    title: 'Lập lại Trật tự Đô thị & Vỉa hè',
    location: 'Tuyến đường trọng điểm & Chợ Phường',
    ideaTemplate: 'Tăng cường tuần tra, kiên quyết xử lý dứt điểm tình trạng lấn chiếm lòng lề đường kinh doanh tự phát xung quanh khu vực chợ phường và các tuyến đường chính. UBND phường phối hợp Công an phường lập chốt trực chéo, không để tái lấn chiếm.'
  },
  {
    id: 'spot-2',
    title: 'An toàn PCCC & Cứu nạn Cứu hộ',
    location: 'Khu chung cư cũ & Nhà trọ mật độ cao',
    ideaTemplate: 'Chỉ đạo tổng rà soát toàn bộ các cơ sở kinh doanh có nguy cơ cháy nổ cao, nhà trọ cho thuê mật độ đông và khu chung cư cũ trên địa bàn phường. Yêu cầu trang bị đầy đủ bình chữa cháy, mở lối thoát nạn thứ 2 và tổ chức thực tập phương án PCCC khu phố.'
  },
  {
    id: 'spot-3',
    title: 'Cải cách Hành chính & Số hóa Một cửa',
    location: 'Bộ phận Tiếp nhận & Trả kết quả UBND Phường',
    ideaTemplate: 'Đẩy mạnh dịch vụ công trực tuyến toàn trình, thực hiện số hóa 100% hồ sơ thủ tục hành chính tại Bộ phận Một cửa UBND phường. Giao Đoàn Thanh niên phường cử lực lượng đoàn viên túc trực hỗ trợ người dân đăng ký tài khoản VNeID và nộp hồ sơ trực tuyến.'
  },
  {
    id: 'spot-4',
    title: 'Công tác Dân vận & Giải phóng Mặt bằng',
    location: 'Dự án hạ tầng giao thông trọng điểm',
    ideaTemplate: 'Giao Khối Dân vận Đảng ủy chỉ đạo Mặt trận Tổ quốc và các tổ chức chính trị - xã hội phường nòng cốt tuyên truyền, vận động các hộ dân thuộc diện giải tỏa bồi thường đồng thuận bàn giao mặt bằng. Phân công cấp ủy viên chi bộ khu phố bám sát từng hộ dân.'
  }
];

const LEVEL_RESOLUTIONS: Resolution[] = [
  {
    id: 'res-1',
    code: 'Nghị quyết số 05-NQ/QU',
    title: 'Nghị quyết Quận ủy về tăng cường quản lý hành lang đô thị, kỷ cương lòng lề đường',
    governingBody: 'Quận ủy ban hành',
    keyKeywords: ['trật tự', 'đô thị', 'lòng đường', 'vỉa hè', 'lấn chiếm', 'chợ', 'đường', 'hành lang'],
    coreContent: 'Xử lý triệt để lấn chiếm vỉa hè làm nơi buôn bán, giải tỏa các chợ tự phát gây cản trở giao thông đường phố.'
  },
  {
    id: 'res-2',
    code: 'Nghị quyết số 18-NQ/TU',
    title: 'Nghị quyết Thành ủy về giữ gìn vệ sinh môi trường đô thị và an toàn phòng cháy chữa cháy',
    governingBody: 'Thành ủy ban hành',
    keyKeywords: ['môi trường', 'rác', 'thoát nước', 'rác thải', 'phòng cháy', 'chữa cháy', 'pccc', 'chung cư', 'an toàn điện'],
    coreContent: 'Bảo vệ môi trường xanh sạch, ngăn chặn tắc nghẽn dòng chảy thoát nước hẻm phố, siết chặt quản lý phòng ngừa cháy nổ chung cư cũ.'
  },
  {
    id: 'res-3',
    code: 'Nghị quyết số 12-NQ/QU',
    title: 'Nghị quyết Quận ủy về đẩy mạnh chuyển đổi số cơ sở hành chính công trực tuyến',
    governingBody: 'Quận ủy ban hành',
    keyKeywords: ['số', 'số hóa', 'công nghệ', 'wifi', 'qr', 'cải cách', 'thủ tục', 'hành chính', 'một cửa'],
    coreContent: 'Tích hợp số hóa cơ sở đảng, cải cách thủ tục và nâng cao chỉ số hài lòng hành chính một cửa thông qua QR code.'
  }
];

export default function DirectiveDrafting() {
  const [idea, setIdea] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('CONCLUSION');
  const [selectedHotSpot, setSelectedHotSpot] = useState<HotSpot | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<'option1' | 'option2' | null>(null);
  const [preferredStyle, setPreferredStyle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'result' | 'versions' | 'history'>('result');

  // Version History states
  const [draftVersions, setDraftVersions] = useState<DraftVersionSnapshot[]>([]);

  const recordVersion = (title: string, content: string, style: string) => {
    const newVer: DraftVersionSnapshot = {
      id: 'v-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      title,
      content,
      style,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setDraftVersions(prev => [newVer, ...prev.slice(0, 14)]);
  };

  const handleRestoreVersion = (ver: DraftVersionSnapshot) => {
    if (!result) return;
    if (selectedOption === 'option2') {
      setResult({
        ...result,
        option2: ver.content,
        styleDescription2: ver.style
      });
    } else {
      setResult({
        ...result,
        option1: ver.content,
        styleDescription1: ver.style
      });
      setSelectedOption('option1');
    }
    setSuccessMsg(`Đã khôi phục phiên bản: "${ver.title}" (${ver.timestamp})`);
    setTimeout(() => setSuccessMsg(null), 3000);
    setActiveRightTab('result');
  };

  // Dynamic Resolution Matching
  const matchingResolutions = useMemo(() => {
    if (!idea.trim()) return [];
    const normalizedIdea = idea.toLowerCase();
    return LEVEL_RESOLUTIONS.filter(res => {
      return res.keyKeywords.some(keyword => normalizedIdea.includes(keyword));
    });
  }, [idea]);

  // History states
  const [historyItems, setHistoryItems] = useState<DirectiveHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const { user } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    const historyQuery = query(
      collection(db, 'directive_history'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      if (!isMounted) return;
      const items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as DirectiveHistoryItem));
      setHistoryItems(items);
    }, (err) => {
      console.error("Error syncing directive history:", err);
    });

    const savedStyle = localStorage.getItem('preferred_draft_style_desc');
    if (savedStyle && isMounted) {
      setPreferredStyle(savedStyle);
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const filteredHistory = useMemo(() => {
    const term = historySearch.toLowerCase().trim();
    if (!term) return historyItems;
    return historyItems.filter(item => 
      (item.idea || '').toLowerCase().includes(term) ||
      (item.selectedOptionText || '').toLowerCase().includes(term) ||
      (item.style || '').toLowerCase().includes(term)
    );
  }, [historyItems, historySearch]);

  const handleSelectHotSpot = (spot: HotSpot) => {
    setSelectedHotSpot(spot);
    setIdea(spot.ideaTemplate);
    setSuccessMsg(`Đã tải vị trí phản ánh nóng: "${spot.title}" (${spot.location})!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setIsGenerating(true);
    setError(null);
    setSuccessMsg(null);
    setSelectedOption(null);

    try {
      const res = await fetch('/api/draft-directive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(),
          documentType: selectedDocType,
          stylePreference: preferredStyle,
          matchedResolutions: matchingResolutions.map(r => `${r.code}: ${r.title}`)
        })
      });

      if (!res.ok) throw new Error("Yêu cầu tạo văn bản chỉ đạo thất bại");
      const data: DraftResult = await res.json();
      setResult(data);
      recordVersion('Phương án 1 (Khởi tạo AI)', data.option1, data.styleDescription1);
      recordVersion('Phương án 2 (Khởi tạo AI)', data.option2, data.styleDescription2);
      setShowModal(true);
      setActiveRightTab('result');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi kết nối với máy chủ AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectOption = async (opt: 'option1' | 'option2', styleDesc: string, text: string) => {
    setSelectedOption(opt);
    setPreferredStyle(styleDesc);
    localStorage.setItem('preferred_draft_style_desc', styleDesc);
    setShowModal(false);
    setActiveRightTab('result');
    recordVersion(`Chốt chọn: ${styleDesc}`, text, styleDesc);

    try {
      await addDoc(collection(db, 'directive_history'), {
        idea: idea.trim(),
        selectedOptionText: text,
        style: styleDesc,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null
      });

      setSuccessMsg(`Đã lưu dự thảo chỉ đạo vào Sổ tay Nhật ký với văn phong: "${styleDesc}".`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Failed to save history:", err);
    }
  };

  const handleDeleteHistory = async (id: string, e: any) => {
    e.stopPropagation();
    setIsDeletingId(id);
    try {
      await deleteDoc(doc(db, 'directive_history', id));
    } catch (err) {
      console.error("Error deleting history doc:", err);
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleReuseHistory = (item: DirectiveHistoryItem) => {
    setIdea(item.idea);
    setResult({
      option1: item.selectedOptionText,
      option2: "Nội dung phương án bổ trợ linh hoạt được tham mưu dựa trên nguồn ý tưởng lịch sử này.",
      styleDescription1: item.style,
      styleDescription2: "Phương án phụ trợ"
    });
    setSelectedOption('option1');
    recordVersion('Tái sử dụng: ' + item.style, item.selectedOptionText, item.style);
    setActiveRightTab('result');
    setSuccessMsg("Đã tải lại nội dung chỉ đạo từ sổ tay nhật ký.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 1500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const handleCreateTask = async (text: string) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        title: `Triển khai chỉ đạo: ${idea.length > 50 ? idea.substring(0, 50) + '...' : idea}`,
        description: text,
        assignedOrganization: "Ủy ban nhân dân phường",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN'),
        status: 'PENDING',
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null
      });

      setSuccessMsg("Đã lập lịch nhiệm vụ đôn đốc UBND phường triển khai chỉ đạo thành công!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Task creation from draft failed:", err);
      setError("Không thể tự động tạo nhiệm vụ chỉ đạo.");
    }
  };

  const clearPreferences = () => {
    localStorage.removeItem('preferred_draft_style_desc');
    setPreferredStyle('');
    setSuccessMsg("Đã xóa tùy chọn ưu tiên phong cách cũ.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans pb-12 px-4 md:px-6">
      
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-2xl p-4 md:p-5 text-white shadow-md border border-blue-800/60 flex items-center justify-between gap-4">
        <div className="space-y-1 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Trợ lý AI Gemini Cấp ủy
            </span>
          </div>
          <h1 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
            <span>Soạn Thảo Ý Kiến Kết Luận & Chỉ Đạo</span>
          </h1>
        </div>
      </div>

      {/* Real-time Toast Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-950 rounded-2xl flex items-center gap-3 text-xs border border-emerald-200 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-950 rounded-2xl flex items-center gap-3 text-xs border border-red-200 shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Compact 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Input & Controls (5/12) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-xl space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>1. Nhập Ý Tưởng & Thể Loại</span>
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-extrabold px-2 py-0.5 rounded-lg border border-blue-200">
                Bước 1
              </span>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Document Category Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Loại hình văn bản:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DOCUMENT_TYPES.map(dt => (
                    <button
                      key={dt.id}
                      type="button"
                      onClick={() => setSelectedDocType(dt.id)}
                      className={`p-2.5 rounded-xl text-left border transition-all text-xs cursor-pointer ${
                        selectedDocType === dt.id
                          ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                      title={dt.desc}
                    >
                      <div className="text-[11px] leading-tight font-extrabold">{dt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ward Leadership Hotspot Quick-Load */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Mẫu nhanh điểm nóng địa bàn:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WARD_HOTSPOTS.map(spot => (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => handleSelectHotSpot(spot)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                        selectedHotSpot?.id === spot.id
                          ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                      }`}
                    >
                      ⚡ {spot.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Raw Idea Textarea */}
              <div className="space-y-1.5">
                <label htmlFor="directive-raw-idea" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Nội dung ý kiến chỉ đạo thô:</span>
                  <span className="text-[10px] text-slate-400 font-normal">{idea.length} ký tự</span>
                </label>
                <textarea
                  id="directive-raw-idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Ví dụ: Tăng cường tuần tra, lập lại trật tự đô thị tại các tuyến đường chính xung quanh chợ phường, xử lý dứt điểm các hộ kinh doanh tự phát..."
                  rows={4}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 leading-relaxed"
                  required
                />
              </div>

              {/* Preferred Style Notice */}
              {preferredStyle && (
                <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-[11px] text-indigo-900 space-y-1">
                  <div className="font-extrabold flex items-center justify-between uppercase tracking-wider text-[10px]">
                    <span className="text-indigo-800">⚡ Văn phong ưu tiên hiện tại:</span>
                    <button 
                      type="button" 
                      onClick={clearPreferences}
                      className="text-[10px] text-red-600 hover:underline font-bold cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                  <p className="italic font-semibold leading-relaxed">"{preferredStyle}"</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating || !idea.trim()}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Trợ lý AI đang tham mưu...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Tham Mưu 02 Phương Án Chỉ Đạo</span>
                  </>
                )}
              </button>
            </form>

            {/* Live Resolution Compliance Checker */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Đối chiếu Nghị quyết cấp trên</span>
                </span>
                <span className="text-[9px] font-bold text-slate-400">Tự động quét</span>
              </div>

              {matchingResolutions.length > 0 ? (
                <div className="space-y-2">
                  {matchingResolutions.map(res => (
                    <div key={res.id} className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] leading-relaxed space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-emerald-900 text-[10px]">{res.code}</span>
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase rounded">
                          Tương thích chuẩn
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 leading-snug">{res.title}</p>
                      <p className="text-[10px] text-slate-600 italic leading-snug">"{res.coreContent}"</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-[10px] text-slate-500 leading-relaxed italic">
                  💡 Nhập nội dung chỉ đạo để tự động đối chiếu tính tương hợp với các Nghị quyết Quận ủy / Thành ủy.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Output & History Studio (7/12) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Tab Switcher for Right Panel */}
          <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
            <button
              onClick={() => setActiveRightTab('result')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'result'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 text-amber-300" />
              <span>Kết Quả</span>
              {result && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
            </button>

            <button
              onClick={() => setActiveRightTab('versions')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'versions'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="w-4 h-4 text-blue-200" />
              <span>Phiên Bản ({draftVersions.length})</span>
            </button>

            <button
              onClick={() => setActiveRightTab('history')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'history'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Nhật Ký ({historyItems.length})</span>
            </button>
          </div>

          {/* TAB 2: VERSIONS HISTORY */}
          {activeRightTab === 'versions' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Danh Sách Phiên Bản Soạn Thảo (Version History)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Các mốc thay đổi và phương án AI đã tạo trong phiên làm việc</p>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-200">
                  {draftVersions.length} phiên bản
                </span>
              </div>

              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {draftVersions.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-xs space-y-2">
                    <History className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">Chưa có lịch sử phiên bản trong phiên</p>
                    <p>Hãy tạo hoặc chọn phương án soạn thảo để ghi nhận các mốc phiên bản.</p>
                  </div>
                ) : (
                  draftVersions.map((ver, idx) => (
                    <div 
                      key={ver.id}
                      className="p-4 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-2xl transition-all space-y-2 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                            #{draftVersions.length - idx}
                          </span>
                          <span className="text-xs font-black text-slate-900">{ver.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          🕒 {ver.timestamp}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 font-normal line-clamp-2 bg-white p-2.5 rounded-xl border border-slate-200/60">
                        {ver.content}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          {ver.style}
                        </span>

                        <button
                          onClick={() => handleRestoreVersion(ver)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Khôi phục bản này</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 1: RESULT STUDIO */}
          {activeRightTab === 'result' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl min-h-[520px] flex flex-col justify-between">
              {isGenerating ? (
                <div className="py-20 text-center space-y-4 my-auto">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
                  <div className="text-sm font-black text-slate-900 animate-pulse uppercase tracking-wider">
                    Trợ lý AI đang soạn thảo dự thảo cấp cao...
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Đang thiết lập kết cấu, định hình văn phong chuẩn mực của Thường trực Đảng ủy và kiểm tra các tiêu chuẩn hành chính.
                  </p>
                </div>
              ) : !result ? (
                <div className="py-20 text-center text-slate-400 text-xs my-auto space-y-4">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-xs mx-auto">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-sm text-slate-900 uppercase tracking-wide">Chưa có dự thảo được tạo</p>
                    <p className="max-w-xs mx-auto leading-relaxed text-slate-500">
                      Hãy nhập ý kiến chỉ đạo ở cột bên trái và bấm <strong>"Tham Mưu"</strong> để trợ lý AI hiển thị 02 phương án văn phong.
                    </p>
                  </div>
                </div>
              ) : !selectedOption ? (
                <div className="py-16 text-center text-slate-400 text-xs my-auto space-y-5">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center shadow-xs mx-auto animate-bounce">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-black text-base text-slate-900 uppercase tracking-wide">Đã hoàn thành 02 phương án tham mưu</p>
                    <p className="max-w-sm mx-auto leading-relaxed text-slate-600 font-medium">
                      Trợ lý đã chuẩn bị 02 phong cách hành văn khác nhau phù hợp với Thường trực Đảng ủy. Nhấp vào nút bên dưới để xem đối chiếu và chọn phương án.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-2xl transition-all shadow-lg shadow-blue-500/25 active:scale-95 cursor-pointer inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Mở Bảng Đối Chiếu 02 Phương Án</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 text-[10px] font-black rounded-lg uppercase tracking-wider border border-indigo-200">
                        {selectedOption === 'option1' ? 'Phương án 1' : 'Phương án 2'}
                      </span>
                      <span className="text-xs text-slate-700 font-extrabold">
                        {selectedOption === 'option1' ? result.styleDescription1 : result.styleDescription2}
                      </span>
                    </div>

                    <button
                      onClick={() => setShowModal(true)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-blue-200 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Đổi phương án</span>
                    </button>
                  </div>

                  {/* Document Draft Box */}
                  <div className="text-xs leading-relaxed text-slate-900 font-normal whitespace-pre-line bg-slate-50 p-5 rounded-2xl border border-slate-200/80 min-h-[320px] max-h-[420px] overflow-y-auto leading-relaxed select-text shadow-inner">
                    {selectedOption === 'option1' ? result.option1 : result.option2}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Đã lưu tự động vào Sổ tay Nhật ký</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyToClipboard(selectedOption === 'option1' ? result.option1 : result.option2)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                      >
                        {copiedText === (selectedOption === 'option1' ? result.option1 : result.option2) ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Sao chép văn bản</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleCreateTask(selectedOption === 'option1' ? result.option1 : result.option2)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                      >
                        <ClipboardCheck className="w-4 h-4" />
                        <span>Giao việc UBND</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HISTORY & NOTEBOOK */}
          {activeRightTab === 'history' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Sổ Tay Nhật Ký Chỉ Đạo</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Lưu trữ bảo mật trên đám mây Firestore</p>
                </div>

                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm lịch sử..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              </div>

              {/* History Items List */}
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">Chưa có nhật ký lưu trữ</p>
                    <p>Các chỉ đạo được duyệt sẽ tự động đồng bộ vào đây.</p>
                  </div>
                ) : (
                  filteredHistory.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => handleReuseHistory(item)}
                      className="group p-4 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-2xl cursor-pointer transition-all space-y-2 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2 py-0.5 bg-white border border-slate-200 text-indigo-900 text-[10px] font-black rounded-md">
                          {item.style || 'Văn bản kết luận'}
                        </span>
                        
                        <button
                          onClick={(e) => handleDeleteHistory(item.id, e)}
                          disabled={isDeletingId === item.id}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Xóa lịch sử"
                        >
                          {isDeletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <p className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-950">
                        💡 {item.idea}
                      </p>
                      
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-normal">
                        {item.selectedOptionText}
                      </p>

                      <div className="text-[10px] text-indigo-600 flex items-center justify-between font-bold pt-1 border-t border-slate-200/60">
                        <span className="flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>Nhấp để tái sử dụng mẫu</span>
                        </span>
                        <span className="text-slate-400 text-[9px] font-mono">
                          {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString('vi-VN') : 'Gần đây'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* 2-Option Proposal Modal Popup */}
      {showModal && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowModal(false)}
          />

          <div className="relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-black uppercase tracking-wider rounded">
                    Thường trực Đảng ủy
                  </span>
                  <h3 className="text-sm font-black uppercase tracking-wide">
                    Chọn Phương Án Hành Văn Chỉ Đạo
                  </h3>
                </div>
                <p className="text-[11px] text-slate-200">
                  Hệ thống AI đề xuất 02 phong cách hành văn tối ưu. Nhấp nút đồng ý ở phương án đồng chí muốn áp dụng.
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns for 2 Options */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-100">
              
              {/* Option 1 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-blue-400 transition-all">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-black rounded-md uppercase tracking-wider border border-blue-200">
                      Phương án 1
                    </span>
                    <span className="text-[10px] text-indigo-700 font-extrabold max-w-[200px] truncate" title={result.styleDescription1}>
                      {result.styleDescription1}
                    </span>
                  </div>

                  <div className="text-xs leading-relaxed text-slate-900 font-normal whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[240px] max-h-[320px] overflow-y-auto leading-relaxed shadow-inner">
                    {result.option1}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleSelectOption('option1', result.styleDescription1, result.option1)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 cursor-pointer"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>Chọn & Áp Dụng Phương Án Này</span>
                  </button>
                </div>
              </div>

              {/* Option 2 */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-400 transition-all">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black rounded-md uppercase tracking-wider border border-emerald-200">
                      Phương án 2
                    </span>
                    <span className="text-[10px] text-emerald-700 font-extrabold max-w-[200px] truncate" title={result.styleDescription2}>
                      {result.styleDescription2}
                    </span>
                  </div>

                  <div className="text-xs leading-relaxed text-slate-900 font-normal whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[240px] max-h-[320px] overflow-y-auto leading-relaxed shadow-inner">
                    {result.option2}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleSelectOption('option2', result.styleDescription2, result.option2)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 cursor-pointer"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>Chọn & Áp Dụng Phương Án Này</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Đóng / Hủy
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
