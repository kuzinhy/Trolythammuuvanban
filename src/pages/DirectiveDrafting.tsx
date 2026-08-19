import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  Sparkles, Loader2, Copy, Check, BookOpen, ThumbsUp, AlertCircle, 
  FileText, CheckCircle2, Trash2, Search, RotateCcw, Award, ClipboardCheck, ArrowUpRight, X,
  MapPin, ShieldCheck, Activity, FileCheck2, Flame
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

interface DirectiveHistoryItem {
  id: string;
  idea: string;
  selectedOptionText: string;
  style: string;
  createdAt: any;
}

interface HotSpot {
  id: string;
  title: string;
  location: string;
  kp: string;
  category: 'Trật tự đô thị' | 'Môi trường' | 'An ninh trật tự' | 'Chuyển đổi số';
  severity: 'Nóng' | 'Cảnh báo' | 'Bình thường';
  description: string;
  ideaTemplate: string;
  x: string;
  y: string;
}

interface Resolution {
  id: string;
  code: string;
  title: string;
  governingBody: string;
  keyKeywords: string[];
  coreContent: string;
}

const WARD_HOT_SPOTS: HotSpot[] = [
  {
    id: 'spot-1',
    title: 'Lấn chiếm vỉa hè, họp chợ tự phát',
    location: 'Xung quanh Chợ phường Phú Cường',
    kp: 'Khu phố 2',
    category: 'Trật tự đô thị',
    severity: 'Nóng',
    description: 'Kinh doanh tự phát lấn chiếm vỉa hè và lòng lề đường gây cản trở giao thông nghiêm trọng giờ cao điểm.',
    ideaTemplate: 'Tập trung lực lượng đô thị phối hợp Công an phường Phú Cường ra quân tuần tra lập lại trật tự hành lang đường phố, kiên quyết xử lý dứt điểm việc lấn chiếm vỉa hè và lề đường xung quanh khu vực Chợ Phú Cường.',
    x: '38%',
    y: '50%'
  },
  {
    id: 'spot-2',
    title: 'Tồn đọng rác thải hẻm thoát nước ô nhiễm',
    location: 'Hẻm 420 đường Cách Mạng Tháng Tám',
    kp: 'Khu phố 4',
    category: 'Môi trường',
    severity: 'Cảnh báo',
    description: 'Rác thải tồn đọng lâu ngày làm tắc nghẽn dòng chảy hẻm hẹp, gây mùi hôi thối ảnh hưởng đến đời sống khu dân cư.',
    ideaTemplate: 'Giao Ủy ban nhân dân phường chủ trì phối hợp với Mặt trận Tổ quốc ra quân dọn dẹp vệ sinh môi trường, nạo vét thông thoáng hẻm thoát nước tại hẻm 420 Cách Mạng Tháng Tám, xử phạt nghiêm hành vi xả rác bừa bãi.',
    x: '68%',
    y: '32%'
  },
  {
    id: 'spot-3',
    title: 'Mất an ninh trật tự hẻm phòng trọ công nhân',
    location: 'Tuyến hẻm số 12 đường Lê Hồng Phong',
    kp: 'Khu phố 1',
    category: 'An ninh trật tự',
    severity: 'Cảnh báo',
    description: 'Thường xuyên tụ tập gây mất an ninh trật tự về đêm, phát sinh tình trạng trộm cắp vặt ảnh hưởng đời sống công nhân.',
    ideaTemplate: 'Yêu cầu Công an phường tăng cường tuần tra mật phục đêm tại hẻm 12 Lê Hồng Phong, hướng dẫn thành lập mô hình liên gia tự quản phòng chống tội phạm, lập lại an ninh trật tự tại các khu nhà trọ công nhân.',
    x: '18%',
    y: '70%'
  },
  {
    id: 'spot-4',
    title: 'Triển khai mạng Wifi miễn phí & mã QR hành chính',
    location: 'Nhà văn hóa Khu phố & Văn phòng Một Cửa',
    kp: 'Khu phố 3',
    category: 'Chuyển đổi số',
    severity: 'Bình thường',
    description: 'Thúc đẩy chuyển đổi số cơ sở, cung cấp sóng Wifi công cộng miễn phí phục vụ nhân dân truy cập thủ tục dịch vụ công.',
    ideaTemplate: 'Giao UBND phường khẩn trương trang bị hệ thống Wifi công cộng miễn phí tại Nhà văn hóa và dán mã QR bảng hướng dẫn quy trình thủ tục hành chính công trực tuyến một cửa để người dân dễ dàng thao tác.',
    x: '78%',
    y: '68%'
  },
  {
    id: 'spot-5',
    title: 'Rà soát an toàn PCCC chung cư cũ 5 tầng',
    location: 'Khu chung cư đường Nguyễn Đình Chiểu',
    kp: 'Khu phố 5',
    category: 'An ninh trật tự',
    severity: 'Nóng',
    description: 'Đường dây điện chằng chịt xuống cấp, không có lối thoát hiểm dự phòng và thiếu trang thiết bị bình cứu hỏa cơ bản.',
    ideaTemplate: 'Chỉ đạo đoàn liên ngành của phường tiến hành rà soát, kiểm tra đột xuất điều kiện an toàn phòng cháy chữa cháy tại chung cư cũ Nguyễn Đình Chiểu, xử lý nghiêm các vi phạm và trang bị bình cứu hỏa công cộng.',
    x: '50%',
    y: '22%'
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<'option1' | 'option2' | null>(null);
  const [preferredStyle, setPreferredStyle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Upgraded interactive states
  const [selectedHotSpot, setSelectedHotSpot] = useState<HotSpot | null>(null);

  // Dynamic Resolution Matching (Compliance check logic)
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

  // 1. Listen to saved directive history in Firestore (realtime & durable)
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

    // Load preferred style from localStorage on mount
    const savedStyle = localStorage.getItem('preferred_draft_style_desc');
    if (savedStyle && isMounted) {
      setPreferredStyle(savedStyle);
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 2. Filter history items based on search query
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
    setSuccessMsg(`Đã tải vị trí phản ánh nóng: "${spot.title}" (${spot.location}) vào khung soạn thảo!`);
    setTimeout(() => setSuccessMsg(null), 4000);
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
          stylePreference: preferredStyle,
          matchedResolutions: matchingResolutions.map(r => `${r.code}: ${r.title}`)
        })
      });

      if (!res.ok) throw new Error("Yêu cầu tạo văn bản chỉ đạo thất bại");
      const data: DraftResult = await res.json();
      setResult(data);
      setShowModal(true); // Open selection popup modal
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
    setShowModal(false); // Close selection popup modal

    try {
      // Record this selection permanently into Firestore history
      await addDoc(collection(db, 'directive_history'), {
        idea: idea.trim(),
        selectedOptionText: text,
        style: styleDesc,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null
      });

      setSuccessMsg(`Đã chọn phương án chỉ đạo & lưu vào Sổ tay Nhật ký với văn phong: "${styleDesc}".`);
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
      option2: "Để tạo thêm các phương án hành văn mới phong phú hơn dựa trên nội dung nguồn này, đồng chí hãy bấm nút 'Tham mưu' bên trái.",
      styleDescription1: item.style,
      styleDescription2: "Phương án bổ trợ linh hoạt"
    });
    setSelectedOption('option1');
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
    <div className="max-w-7xl mx-auto space-y-6 font-sans transform-gpu pb-12 px-4 md:px-6">
      
      {/* Top Banner with High-end Backdrop Styling */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-800 to-indigo-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-white/10">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-6">
          <Award className="w-96 h-96" />
        </div>
        
        <div className="space-y-2 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              Công nghệ AI Gemini Cấp Cao
            </span>
            <span className="px-3 py-1 rounded-full bg-white/15 text-white border border-white/20 text-[10px] font-bold tracking-wide uppercase">
              Chỉ đạo Thường trực Đảng ủy
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white leading-tight">
            Trợ Lý Tham Mưu & Soạn Thảo Kết Luận Chỉ Đạo
          </h1>
          <p className="text-xs md:text-sm text-indigo-100 max-w-3xl leading-relaxed font-normal">
            Phục vụ đắc lực Bí thư Đảng ủy phường số hóa quy trình ra kết luận chỉ đạo. Chỉ với một ý tưởng, trợ lý tự động đối chiếu các quy chuẩn, cung cấp hai phương án hành văn tối ưu và học hỏi phong cách ưa thích của lãnh đạo.
          </p>
        </div>
      </div>

      {/* Real-time Toast Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-950 rounded-2xl flex items-center gap-3 text-xs border border-emerald-200 shadow-md transition-all">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {/* Upgraded Option 2: Geospatial Command Map */}
      <div className="bg-slate-900 text-slate-100 rounded-3xl p-5 md:p-6 border border-slate-800 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-white">
              <MapPin className="w-5 h-5 text-red-500 animate-pulse" />
              <span>Bản đồ số địa bàn & Điểm nóng phản ánh thời gian thực</span>
            </h2>
            <p className="text-xs text-slate-400">
              Hệ thống giám sát địa bàn phường Phú Cường. Nhấp chọn các điểm nóng để tự động nạp thông tin chỉ đạo.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold self-start sm:self-center">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span><span className="text-red-400">Nóng ({WARD_HOT_SPOTS.filter(s => s.severity === 'Nóng').length})</span></span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span><span className="text-amber-400">Cảnh báo ({WARD_HOT_SPOTS.filter(s => s.severity === 'Cảnh báo').length})</span></span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span><span className="text-blue-400">Bình thường ({WARD_HOT_SPOTS.filter(s => s.severity === 'Bình thường').length})</span></span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Interactive SVG Map Visualizer (8/12) */}
          <div className="lg:col-span-8 bg-slate-950/80 rounded-2xl p-4 border border-slate-800 relative min-h-[320px] md:min-h-[380px] overflow-hidden flex flex-col justify-between">
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            {/* Styled Ward Boundary Represented in Elegant SVG */}
            <svg viewBox="0 0 800 450" className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" fill="none">
              {/* Boundary Rivers & Main Arteries */}
              <path d="M 50 150 Q 250 80 400 120 T 750 60" stroke="#1e293b" strokeWidth="4" strokeDasharray="5,5" />
              <path d="M 120 400 Q 350 350 480 390 T 780 320" stroke="#1e293b" strokeWidth="3" />
              <path d="M 300 0 Q 320 220 280 450" stroke="#10b981" strokeWidth="2" strokeOpacity="0.3" /> {/* Green Line */}
              
              {/* Sector Division Areas */}
              <text x="120" y="240" fill="#475569" fontSize="11" fontWeight="bold">KHU PHỐ 1</text>
              <text x="320" y="160" fill="#475569" fontSize="11" fontWeight="bold">KHU PHỐ 5</text>
              <text x="350" y="320" fill="#475569" fontSize="11" fontWeight="bold">KHU PHỐ 2</text>
              <text x="620" y="130" fill="#475569" fontSize="11" fontWeight="bold">KHU PHỐ 4</text>
              <text x="680" y="300" fill="#475569" fontSize="11" fontWeight="bold">KHU PHỐ 3</text>
            </svg>

            <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-500 font-bold tracking-wide uppercase">
              <span>🗺️ BẢN ĐỒ PHÂN CHIA ĐỊA BÀN PHƯỜNG PHÚ CƯỜNG</span>
              <span className="text-blue-400">Hệ thống đồng bộ trực tiếp</span>
            </div>

            {/* Glowing Hot Spot Points plotted dynamically */}
            <div className="absolute inset-0">
              {WARD_HOT_SPOTS.map((spot) => {
                const isSelected = selectedHotSpot?.id === spot.id;
                const dotColor = spot.severity === 'Nóng' 
                  ? 'bg-red-500' 
                  : spot.severity === 'Cảnh báo' 
                    ? 'bg-amber-500' 
                    : 'bg-blue-500';

                return (
                  <button
                    key={spot.id}
                    onClick={() => handleSelectHotSpot(spot)}
                    style={{ left: spot.x, top: spot.y }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 focus:outline-none"
                    title={`${spot.title} - ${spot.kp}`}
                  >
                    {/* Ripple Animations for Active/Hot points */}
                    <span className="absolute inline-flex h-8 w-8 rounded-full opacity-40 animate-ping -left-2 -top-2 bg-current" style={{ color: spot.severity === 'Nóng' ? '#ef4444' : spot.severity === 'Cảnh báo' ? '#f59e0b' : '#3b82f6' }}></span>
                    <span className={`relative inline-flex rounded-full h-4.5 w-4.5 border-2 border-slate-900 shadow-lg cursor-pointer transition-all ${dotColor} ${isSelected ? 'scale-130 ring-4 ring-white/40' : 'group-hover:scale-125'}`} />
                    
                    {/* Tooltip on hover */}
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 bg-slate-950 text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-opacity border border-slate-800 pointer-events-none">
                      {spot.title} ({spot.kp})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative z-10 text-[10px] text-slate-400 italic">
              * Click chọn chấm tròn nhấp nháy trên bản đồ để kết xuất tự động dự thảo chỉ đạo.
            </div>
          </div>

          {/* Active Spot Detail Card (4/12) */}
          <div className="lg:col-span-4 bg-slate-950/40 rounded-2xl p-5 border border-slate-800 flex flex-col justify-between space-y-4">
            {selectedHotSpot ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Chi tiết điểm nóng</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      selectedHotSpot.severity === 'Nóng' 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : selectedHotSpot.severity === 'Cảnh báo'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {selectedHotSpot.severity}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider">{selectedHotSpot.kp}</span>
                    <h3 className="text-xs font-black text-white leading-snug">{selectedHotSpot.title}</h3>
                    <p className="text-[11px] text-slate-400 italic flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-400" />
                      <span>{selectedHotSpot.location}</span>
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                    {selectedHotSpot.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="text-[10px] text-slate-500 font-medium">Bản mẫu tham mưu đã được thiết lập sẵn sàng.</div>
                  <button
                    onClick={() => handleSelectHotSpot(selectedHotSpot)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                    <span>Nạp nội dung chỉ đạo</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-10">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 animate-pulse">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-300 uppercase tracking-wider">Giám sát mục tiêu</p>
                  <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed">Đồng chí chưa chọn điểm phản ánh nào. Hãy nhấp vào các điểm trên bản đồ.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main 3-Column Modern Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Column 1: Input & Configuration (Width: 3/12) */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Nguồn Ý Tưởng</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Nhập ý kiến thô hoặc nhiệm vụ thực tế tại địa phương.</p>
              </div>

              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="directive-raw-idea" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Ý kiến chỉ đạo thô:
                  </label>
                  <textarea
                    id="directive-raw-idea"
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="Ví dụ: Tăng cường tuần tra, lập lại trật tự đô thị tại các tuyến đường chính xung quanh chợ phường, xử lý dứt điểm các hộ kinh doanh tự phát lấn chiếm lòng đường..."
                    rows={6}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all text-slate-800 placeholder:text-slate-400 leading-relaxed"
                    required
                  />
                </div>

                {preferredStyle && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-[11px] text-indigo-900 space-y-1.5">
                    <div className="font-extrabold flex items-center justify-between uppercase tracking-wider text-[10px]">
                      <span className="text-indigo-800">⚡ Văn phong đã ưu tiên:</span>
                      <button 
                        type="button" 
                        onClick={clearPreferences}
                        className="text-[10px] text-red-600 hover:underline font-bold"
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
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang tham mưu...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Tham mưu</span>
                    </>
                  )}
                </button>
              </form>

              {/* Upgraded Option 1: Live Compliance Match Checker */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Đối chiếu Nghị quyết</span>
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">Tự động quét</span>
                </div>

                {matchingResolutions.length > 0 ? (
                  <div className="space-y-2">
                    {matchingResolutions.map(res => (
                      <div key={res.id} className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] leading-relaxed space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-emerald-800 text-[10px]">{res.code}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase rounded">
                            Tương thích
                          </span>
                        </div>
                        <p className="font-black text-slate-700 leading-snug">{res.title}</p>
                        <p className="text-[10px] text-slate-500 italic leading-snug">"{res.coreContent}"</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-[10px] text-slate-500 leading-relaxed italic">
                    💡 Nhập nội dung chỉ đạo hoặc nhấp điểm nóng trên bản đồ để tự động đối sánh tính tương hợp với các Nghị quyết cấp trên.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed space-y-2">
              <div className="font-bold text-slate-700 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Quy định thể chế chỉ đạo</span>
              </div>
              <p>Mẫu văn bản được đồng bộ hóa từ Google Drive cơ quan, đảm bảo đúng quy chuẩn và thẩm quyền ban hành.</p>
            </div>
          </div>
        </div>

        {/* Column 2: Active Generated Results (Width: 6/12) */}
        <div className="lg:col-span-6 space-y-6 flex flex-col">
          {isGenerating && (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4 shadow-xs flex-1 flex flex-col items-center justify-center min-h-[400px]">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
              <div className="text-sm font-black text-slate-900 animate-pulse uppercase tracking-wider">Trợ lý AI đang soạn thảo dự thảo cấp cao...</div>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                Hệ thống đang truy xuất kho dữ liệu văn bản kết luận mẫu trên Drive để thiết lập kết cấu, định hình văn phong chuẩn mực của Thường trực Đảng ủy.
              </p>
            </div>
          )}

          {!isGenerating && !result && (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center text-slate-400 text-xs flex-1 flex flex-col items-center justify-center min-h-[400px] space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-xs">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-sm text-slate-800 uppercase tracking-wide">Đang đợi đầu vào ý tưởng</p>
                <p className="max-w-xs leading-relaxed text-slate-500">Đồng chí hãy điền ý kiến chỉ đạo ở mục bên trái rồi bấm nút để trợ lý AI thực hiện tham mưu.</p>
              </div>
            </div>
          )}

          {!isGenerating && result && selectedOption && (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                  <span>Dự thảo chỉ đạo đã chọn</span>
                </h3>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 border border-blue-200"
                >
                  <RotateCcw className="w-3 h-3" />
                  Đổi phương án
                </button>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between flex-1 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-800 text-[10px] font-black rounded-md uppercase tracking-wider border border-indigo-200">
                      {selectedOption === 'option1' ? 'Phương án 1' : 'Phương án 2'}
                    </span>
                    <span className="text-[10px] text-indigo-600 font-extrabold">
                      {selectedOption === 'option1' ? result.styleDescription1 : result.styleDescription2}
                    </span>
                  </div>

                  <div className="text-xs leading-relaxed text-slate-800 font-normal whitespace-pre-line bg-slate-50/50 p-5 rounded-2xl border border-slate-100 min-h-[250px] max-h-[380px] overflow-y-auto leading-relaxed">
                    {selectedOption === 'option1' ? result.option1 : result.option2}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Đã lưu vào Sổ tay nhật ký</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyToClipboard(selectedOption === 'option1' ? result.option1 : result.option2)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-slate-200"
                    >
                      {copiedText === (selectedOption === 'option1' ? result.option1 : result.option2) ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleCreateTask(selectedOption === 'option1' ? result.option1 : result.option2)}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                    >
                      <span>Giao việc UBND</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isGenerating && result && !selectedOption && (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center text-slate-400 text-xs flex-1 flex flex-col items-center justify-center min-h-[400px] space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-xs animate-bounce">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-sm text-slate-800 uppercase tracking-wide">Chưa có phương án nào được chọn</p>
                <p className="max-w-xs leading-relaxed text-slate-500">Đồng chí hãy nhấp vào nút bên dưới để mở bảng đối chiếu 02 phương án chỉ đạo và xác nhận phương án áp dụng.</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md active:scale-95"
              >
                Xem 02 Phương Án & Chọn
              </button>
            </div>
          )}
        </div>

        {/* Column 3: Durable History of Chosen Directives (Width: 3/12) */}
        <div className="lg:col-span-3 space-y-6 flex flex-col">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Sổ tay Nhật ký Chỉ đạo</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Nhật ký đồng bộ của Đảng bộ phường</p>
              </div>

              {/* History Search Box */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm lịch sử chỉ đạo..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* History Items list */}
              <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-[11px] space-y-1">
                    <AlertCircle className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-600">Trống nhật ký</p>
                    <p>Chưa có chỉ đạo nào được ghi nhận hoặc không khớp bộ lọc.</p>
                  </div>
                ) : (
                  filteredHistory.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => handleReuseHistory(item)}
                      className="group relative p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-200 rounded-2xl cursor-pointer transition-all duration-150 space-y-2 text-left"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="px-2 py-0.2 bg-white border border-slate-200 text-slate-700 text-[9px] font-bold rounded">
                          {item.style || 'Văn bản kết luận'}
                        </span>
                        
                        <button
                          onClick={(e) => handleDeleteHistory(item.id, e)}
                          disabled={isDeletingId === item.id}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Xóa lịch sử"
                        >
                          {isDeletingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>

                      <p className="text-[10px] font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-900">
                        {item.idea}
                      </p>
                      
                      <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                        {item.selectedOptionText}
                      </p>

                      <div className="text-[9px] text-slate-400 flex items-center gap-1 font-semibold pt-1">
                        <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        <span>Nhấp để tải lại nội dung</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Đồng bộ: Cloud Firestore</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 2-Option Proposal Modal Popup */}
      {showModal && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop Overlay with fine blur */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowModal(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-slate-50 rounded-3xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-black uppercase tracking-wider rounded">
                    Thường trực Đảng ủy
                  </span>
                  <h3 className="text-sm font-black uppercase tracking-wide">
                    Chọn phương án chỉ đạo phù hợp
                  </h3>
                </div>
                <p className="text-[11px] text-indigo-100">
                  Dưới đây là 02 dự thảo do AI tham mưu. Nhấp nút chọn ở phương án đồng chí muốn áp dụng và lưu vào Sổ tay.
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body containing 2 options */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-100">
              
              {/* Option 1 Option Box */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-blue-300 transition-all">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-black rounded-md uppercase tracking-wider border border-blue-200">
                      Phương án 1
                    </span>
                    <span className="text-[10px] text-indigo-600 font-extrabold max-w-[180px] truncate" title={result.styleDescription1}>
                      {result.styleDescription1}
                    </span>
                  </div>

                  <div className="text-xs leading-relaxed text-slate-800 font-normal whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[220px] max-h-[300px] overflow-y-auto leading-relaxed">
                    {result.option1}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleSelectOption('option1', result.styleDescription1, result.option1)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 active:scale-98 cursor-pointer"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Đồng ý & Áp dụng lối văn này</span>
                  </button>
                </div>
              </div>

              {/* Option 2 Option Box */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-all">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black rounded-md uppercase tracking-wider border border-emerald-200">
                      Phương án 2
                    </span>
                    <span className="text-[10px] text-emerald-600 font-extrabold max-w-[180px] truncate" title={result.styleDescription2}>
                      {result.styleDescription2}
                    </span>
                  </div>

                  <div className="text-xs leading-relaxed text-slate-800 font-normal whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[220px] max-h-[300px] overflow-y-auto leading-relaxed">
                    {result.option2}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleSelectOption('option2', result.styleDescription2, result.option2)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 active:scale-98 cursor-pointer"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Đồng ý & Áp dụng lối văn này</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Hủy bỏ
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
