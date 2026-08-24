import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  Sparkles, Loader2, Copy, Check, BookOpen, ThumbsUp, AlertCircle, 
  FileText, CheckCircle2, Trash2, Search, RotateCcw, ClipboardCheck, ArrowUpRight, X,
  ShieldCheck, History, Edit3, Save, Send, Share2, CornerDownRight, CheckSquare, Download
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
  icon: string;
  title: string;
  location: string;
  ideaTemplate: string;
}

const DOCUMENT_TYPES = [
  { id: 'CONCLUSION', label: 'Thông báo Kết luận', desc: 'Kết luận cuộc họp Thường trực / Ban Thường vụ Đảng ủy phường' },
  { id: 'ENDORSEMENT', label: 'Ý kiến Bút phê', desc: 'Bút phê chỉ đạo trực tiếp phân luồng xử lý văn bản đến' },
  { id: 'DIRECTIVE', label: 'Chỉ thị Cấp ủy', desc: 'Chỉ thị của Đảng ủy phường về các nhiệm vụ trọng tâm' },
  { id: 'RESOLUTION', label: 'Nghị quyết Chuyên đề', desc: 'Nghị quyết chuyên đề của Đảng ủy chỉ đạo hệ thống chính trị' },
];

const WARD_HOTSPOTS: HotSpot[] = [
  {
    id: 'spot-1',
    icon: '🏙️',
    title: 'Trật tự Đô thị & Lòng lề đường',
    location: 'Tuyến đường trọng điểm & Khu vực Chợ Phường',
    ideaTemplate: 'Tăng cường tuần tra, kiên quyết xử lý dứt điểm tình trạng lấn chiếm lòng lề đường kinh doanh tự phát xung quanh chợ và các tuyến đường chính. Giao UBND phường chủ trì, Công an phường lập chốt trực chéo kiên quyết không để tái diễn.'
  },
  {
    id: 'spot-2',
    icon: '🔥',
    title: 'An toàn PCCC & Cứu nạn Cứu hộ',
    location: 'Nhà trọ mật độ cao & Chung cư cũ',
    ideaTemplate: 'Chỉ đạo tổng rà soát an toàn PCCC các cơ sở nhà trọ mật độ cao, chung cư cũ và cơ sở kinh doanh có điều kiện. Yêu cầu trang bị 100% bình chữa cháy, mở lối thoát nạn thứ 2 và tổ chức diễn tập PCCC tại từng khu phố.'
  },
  {
    id: 'spot-3',
    icon: '💻',
    title: 'Cải cách TTHC & Đề án 06 / VNeID',
    location: 'Bộ phận Tiếp nhận & Trả kết quả Một cửa',
    ideaTemplate: 'Đẩy mạnh dịch vụ công trực tuyến toàn trình và kích hoạt tài khoản VNeID mức 2 cho người dân. Giao UBND phường số hóa 100% hồ sơ tiếp nhận, Đoàn Thanh niên duy trì tổ thanh niên tình nguyện hỗ trợ tại Bộ phận Một cửa.'
  },
  {
    id: 'spot-4',
    icon: '🚩',
    title: 'Công tác Xây dựng Đảng & Chi bộ',
    location: 'Chi bộ các Khu phố & Cơ quan',
    ideaTemplate: 'Nâng cao chất lượng sinh hoạt chi bộ định kỳ và sinh hoạt chuyên đề; tăng cường phân công đảng viên phụ trách hộ gia đình; chủ động nắm bắt tâm tư nhân dân và phát triển đảng viên mới đạt chỉ tiêu Quận ủy giao.'
  },
  {
    id: 'spot-5',
    icon: '🏗️',
    title: 'GPMB & Đầu tư Hạ tầng Cơ sở',
    location: 'Dự án hạ tầng giao thông & chỉnh trang đô thị',
    ideaTemplate: 'Tập trung công tác bồi thường, hỗ trợ, giải phóng mặt bằng các dự án trọng điểm. Khối Dân vận, Mặt trận Tổ quốc và các đoàn thể đi trước nắm tình hình, kiên trì tuyên truyền, vận động tạo sự đồng thuận cao của người dân.'
  },
  {
    id: 'spot-6',
    icon: '🤝',
    title: 'An sinh Xã hội & Đời sống Dân sinh',
    location: 'Hộ nghèo, đối tượng chính sách toàn địa bàn',
    ideaTemplate: 'Tập trung rà soát, chăm lo kịp thời cho các gia đình chính sách, người có công và hộ có hoàn cảnh khó khăn; khẩn trương giải quyết dứt điểm các kiến nghị bức xúc của cử tri tại các buổi tiếp xúc cơ sở.'
  }
];

const LEVEL_RESOLUTIONS: Resolution[] = [
  {
    id: 'res-1',
    code: 'Nghị quyết số 05-NQ/QU',
    title: 'Nghị quyết Quận ủy về quản lý hành lang đô thị và kỷ cương vỉa hè',
    governingBody: 'Quận ủy ban hành',
    keyKeywords: ['trật tự', 'đô thị', 'lòng đường', 'vỉa hè', 'lấn chiếm', 'chợ', 'đường', 'hành lang'],
    coreContent: 'Xử lý triệt để lấn chiếm vỉa hè kinh doanh, giải tỏa các điểm họp chợ tự phát cản trở an toàn giao thông.'
  },
  {
    id: 'res-2',
    code: 'Nghị quyết số 18-NQ/TU',
    title: 'Nghị quyết Thành ủy về an toàn PCCC và vệ sinh môi trường đô thị',
    governingBody: 'Thành ủy ban hành',
    keyKeywords: ['môi trường', 'rác', 'thoát nước', 'phòng cháy', 'chữa cháy', 'pccc', 'chung cư', 'nhà trọ', 'an toàn điện'],
    coreContent: 'Bảo đảm an toàn PCCC tại các khu dân cư đông đúc, nhà trọ cho thuê và ngăn ngừa cháy nổ.'
  },
  {
    id: 'res-3',
    code: 'Nghị quyết số 12-NQ/QU',
    title: 'Nghị quyết Quận ủy về chuyển đổi số và nâng cao hiệu quả hành chính Một cửa',
    governingBody: 'Quận ủy ban hành',
    keyKeywords: ['số', 'số hóa', 'công nghệ', 'vneid', 'cải cách', 'thủ tục', 'hành chính', 'một cửa', 'đề án 06'],
    coreContent: 'Số hóa hồ sơ thủ tục hành chính, cải cách quy trình tiếp nhận và nâng cao tỷ lệ giải quyết trực tuyến.'
  }
];

const DIRECTIVE_QUICK_TAGS = [
  { label: 'Giao UBND phường', text: 'Giao UBND phường (Chủ tịch UBND chỉ đạo): ' },
  { label: 'Giao Công an phường', text: 'Giao Công an phường phối hợp: ' },
  { label: 'Khối Dân vận - MTTQ', text: 'Đề nghị Khối Dân vận, Ủy ban MTTQ và các đoàn thể phường: ' },
  { label: 'Chi bộ Khu phố', text: 'Yêu cầu Cấp ủy các Chi bộ khu phố: ' },
  { label: 'Hạn báo cáo', text: 'Báo cáo Thường trực Đảng ủy trước ngày ...' },
];

export default function DirectiveDrafting() {
  const [idea, setIdea] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('CONCLUSION');
  const [selectedHotSpot, setSelectedHotSpot] = useState<HotSpot | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedOptionTab, setSelectedOptionTab] = useState<'option1' | 'option2'>('option1');
  const [preferredStyle, setPreferredStyle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'result' | 'versions' | 'history'>('result');

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState('');

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
    if (selectedOptionTab === 'option2') {
      setResult({
        ...result,
        option2: ver.content,
        styleDescription2: ver.style
      });
      setEditableContent(ver.content);
    } else {
      setResult({
        ...result,
        option1: ver.content,
        styleDescription1: ver.style
      });
      setEditableContent(ver.content);
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
      limit(30)
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

  // When result or tab changes, sync editable content
  useEffect(() => {
    if (result) {
      setEditableContent(selectedOptionTab === 'option1' ? result.option1 : result.option2);
      setIsEditing(false);
    }
  }, [result, selectedOptionTab]);

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
    setSuccessMsg(`Đã chọn nội dung: "${spot.title}"`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleAppendTag = (tagText: string) => {
    setIdea(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return tagText;
      return `${trimmed}\n- ${tagText}`;
    });
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setIsGenerating(true);
    setError(null);
    setSuccessMsg(null);
    setIsEditing(false);

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
      setSelectedOptionTab('option1');
      setEditableContent(data.option1);
      recordVersion('Phương án 1 (Quyết liệt - Kỷ cương)', data.option1, data.styleDescription1);
      recordVersion('Phương án 2 (Đồng bộ - Dân vận khéo)', data.option2, data.styleDescription2);
      setActiveRightTab('result');
      
      // Auto save the primary option to history
      try {
        await addDoc(collection(db, 'directive_history'), {
          idea: idea.trim(),
          selectedOptionText: data.option1,
          style: data.styleDescription1,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null
        });
      } catch (saveErr) {
        console.warn("Auto save history error:", saveErr);
      }

      setSuccessMsg("Đã hoàn thành tham mưu 02 phương án chỉ đạo của Bí thư Đảng ủy!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã xảy ra lỗi khi kết nối với máy chủ AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveInlineEdit = () => {
    if (!result) return;
    if (selectedOptionTab === 'option1') {
      setResult({ ...result, option1: editableContent });
      recordVersion('Chỉnh sửa tay (Phương án 1)', editableContent, result.styleDescription1);
    } else {
      setResult({ ...result, option2: editableContent });
      recordVersion('Chỉnh sửa tay (Phương án 2)', editableContent, result.styleDescription2);
    }
    setIsEditing(false);
    setSuccessMsg("Đã cập nhật nội dung chỉnh sửa trực tiếp!");
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleSelectAndSaveStyle = async (opt: 'option1' | 'option2') => {
    if (!result) return;
    setSelectedOptionTab(opt);
    const styleDesc = opt === 'option1' ? result.styleDescription1 : result.styleDescription2;
    const content = opt === 'option1' ? result.option1 : result.option2;

    setPreferredStyle(styleDesc);
    localStorage.setItem('preferred_draft_style_desc', styleDesc);

    try {
      await addDoc(collection(db, 'directive_history'), {
        idea: idea.trim(),
        selectedOptionText: content,
        style: styleDesc,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null
      });
      setSuccessMsg(`Đã chọn và lưu văn bản chỉ đạo: "${styleDesc}".`);
      setTimeout(() => setSuccessMsg(null), 3000);
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
      option2: item.selectedOptionText,
      styleDescription1: item.style,
      styleDescription2: "Phương án bổ trợ"
    });
    setSelectedOptionTab('option1');
    setEditableContent(item.selectedOptionText);
    recordVersion('Tái sử dụng: ' + item.style, item.selectedOptionText, item.style);
    setActiveRightTab('result');
    setSuccessMsg("Đã tải lại nội dung chỉ đạo từ sổ tay nhật ký.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setSuccessMsg("Đã sao chép nội dung chỉ đạo vào bộ nhớ tạm!");
      setTimeout(() => {
        setCopiedText(null);
        setSuccessMsg(null);
      }, 2500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const handleCreateTask = async (text: string) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        title: `Triển khai chỉ đạo Bí thư Đảng ủy: ${idea.length > 60 ? idea.substring(0, 60) + '...' : idea}`,
        description: text,
        assignedOrganization: "Ủy ban nhân dân phường",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN'),
        status: 'PENDING',
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null
      });

      setSuccessMsg("Đã tạo nhiệm vụ đôn đốc UBND phường triển khai chỉ đạo thành công!");
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
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 font-sans pb-12 px-4 md:px-6">
      
      {/* Header Banner - Focused & Official */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 rounded-2xl p-4 md:p-5 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Trợ Lý AI Thường Trực Cấp Ủy
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-bold">
              Vai trò: Bí thư Đảng ủy phường
            </span>
          </div>
          <h1 className="text-base md:text-lg font-black tracking-tight text-white flex items-center gap-2">
            <span>Soạn Thảo Ý Kiến Kết Luận & Chỉ Đạo Của Bí Thư Đảng Ủy</span>
          </h1>
          <p className="text-xs text-slate-300">
            Cô đọng, tập trung, đanh thép • Lãnh đạo toàn diện UBND phường, Công an, Mặt trận - Đoàn thể và Chi bộ khu phố
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 text-emerald-950 rounded-xl flex items-center gap-3 text-xs border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 text-red-950 rounded-xl flex items-center gap-3 text-xs border border-red-200 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Main Studio Grid (5 cols input, 7 cols output) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Input Form (5/12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-2xs space-y-4">
            
            {/* Step Header */}
            <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Nội Dung & Ý Kiến Chỉ Đạo</span>
              </h2>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-black px-2 py-0.5 rounded-md border border-blue-200">
                Nhập liệu
              </span>
            </div>

            <form onSubmit={handleGenerate} className="space-y-3.5">
              
              {/* Document Form Selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Hình thức văn bản chỉ đạo:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {DOCUMENT_TYPES.map(dt => (
                    <button
                      key={dt.id}
                      type="button"
                      onClick={() => setSelectedDocType(dt.id)}
                      className={`p-2 rounded-xl text-left border transition-all text-xs cursor-pointer ${
                        selectedDocType === dt.id
                          ? 'bg-blue-600 text-white font-black border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                      title={dt.desc}
                    >
                      <div className="text-[11px] leading-tight font-black">{dt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Themes by Ward Party Secretary */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Chủ đề trọng tâm địa bàn phường:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WARD_HOTSPOTS.map(spot => (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => handleSelectHotSpot(spot)}
                      className={`p-2 rounded-xl text-[11px] text-left border transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedHotSpot?.id === spot.id
                          ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="text-xs">{spot.icon}</span>
                      <span className="truncate leading-tight">{spot.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="directive-raw-idea" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Ý kiến chỉ đạo nguồn của Bí thư:
                  </label>
                  {idea && (
                    <button
                      type="button"
                      onClick={() => { setIdea(''); setSelectedHotSpot(null); }}
                      className="text-[10px] text-slate-400 hover:text-red-600 font-semibold cursor-pointer"
                    >
                      Xóa nội dung
                    </button>
                  )}
                </div>

                <textarea
                  id="directive-raw-idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Nhập nhanh ý kiến chỉ đạo, ví dụ: Yêu cầu UBND và Công an phường mở đợt cao điểm lập lại trật tự đô thị tuyến đường A, giải tỏa các hộ lấn chiếm buôn bán trước ngày 30..."
                  rows={4}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 leading-relaxed"
                  required
                />
              </div>

              {/* Quick Append Tags */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Chèn nhanh phân công:
                </span>
                <div className="flex flex-wrap gap-1">
                  {DIRECTIVE_QUICK_TAGS.map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAppendTag(tag.text)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded-md text-[10px] font-semibold border border-slate-200 transition-colors cursor-pointer"
                    >
                      + {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Saved Preference */}
              {preferredStyle && (
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-bold">Phong cách ưu tiên: </span>
                    <span className="italic">{preferredStyle}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={clearPreferences}
                    className="text-[10px] text-red-600 hover:underline font-bold flex-shrink-0 cursor-pointer"
                  >
                    Xóa
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGenerating || !idea.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tham mưu ý kiến chỉ đạo...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Tham Mưu 02 Phương Án Chỉ Đạo Của Bí Thư</span>
                  </>
                )}
              </button>
            </form>

            {/* Resolution Check */}
            {matchingResolutions.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Căn cứ Nghị quyết cấp trên:</span>
                </span>
                {matchingResolutions.map(res => (
                  <div key={res.id} className="p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[10px] space-y-0.5">
                    <div className="font-black text-emerald-900">{res.code}: {res.title}</div>
                    <div className="text-slate-600 italic">"{res.coreContent}"</div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Output & Studio View (7/12) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* View Mode Tabs */}
          <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1">
            <button
              onClick={() => setActiveRightTab('result')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'result'
                  ? 'bg-blue-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Văn Bản Chỉ Đạo</span>
              {result && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
            </button>

            <button
              onClick={() => setActiveRightTab('versions')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'versions'
                  ? 'bg-blue-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5 text-blue-200" />
              <span>Phiên Bản ({draftVersions.length})</span>
            </button>

            <button
              onClick={() => setActiveRightTab('history')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeRightTab === 'history'
                  ? 'bg-blue-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Sổ Tay Chỉ Đạo ({historyItems.length})</span>
            </button>
          </div>

          {/* TAB 1: RESULT STUDIO (DIRECT PREVIEW & INLINE EDITING) */}
          {activeRightTab === 'result' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs min-h-[480px] flex flex-col justify-between space-y-4">
              {isGenerating ? (
                <div className="py-20 text-center space-y-3 my-auto">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
                  <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Đang soạn thảo ý kiến chỉ đạo của Bí thư Đảng ủy...
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Tập trung phân công rõ việc cho UBND, Công an, Mặt trận và Chi bộ khu phố.
                  </p>
                </div>
              ) : !result ? (
                <div className="py-16 text-center text-slate-400 text-xs my-auto space-y-3">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-2xs mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-xs text-slate-900 uppercase tracking-wide">Chưa có dự thảo chỉ đạo</p>
                    <p className="max-w-xs mx-auto text-slate-500 text-[11px] leading-relaxed">
                      Nhập nội dung ý kiến ở cột bên trái và bấm <strong>"Tham Mưu"</strong> để hệ thống tạo 02 phương án văn bản hoàn chỉnh.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 flex-1 flex flex-col justify-between">
                  
                  {/* Two-Option Switcher Tabs */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setSelectedOptionTab('option1'); setIsEditing(false); }}
                      className={`p-2 rounded-lg text-left transition-all cursor-pointer ${
                        selectedOptionTab === 'option1'
                          ? 'bg-white text-blue-900 shadow-2xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-blue-700">Phương án 1</span>
                        {selectedOptionTab === 'option1' && <Check className="w-3 h-3 text-blue-600" />}
                      </div>
                      <div className="text-[11px] font-bold truncate mt-0.5">{result.styleDescription1}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setSelectedOptionTab('option2'); setIsEditing(false); }}
                      className={`p-2 rounded-lg text-left transition-all cursor-pointer ${
                        selectedOptionTab === 'option2'
                          ? 'bg-white text-emerald-900 shadow-2xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-emerald-700">Phương án 2</span>
                        {selectedOptionTab === 'option2' && <Check className="w-3 h-3 text-emerald-600" />}
                      </div>
                      <div className="text-[11px] font-bold truncate mt-0.5">{result.styleDescription2}</div>
                    </button>
                  </div>

                  {/* Header info of selected draft */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md ${
                        selectedOptionTab === 'option1' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {selectedOptionTab === 'option1' ? 'Quyết Liệt • Kỷ Cương' : 'Đồng Bộ • Dân Vận'}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">
                        {selectedOptionTab === 'option1' ? result.styleDescription1 : result.styleDescription2}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={handleSaveInlineEdit}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Save className="w-3 h-3" />
                          <span>Lưu sửa</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa trực tiếp</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Draft Text Content Area */}
                  {isEditing ? (
                    <textarea
                      value={editableContent}
                      onChange={(e) => setEditableContent(e.target.value)}
                      rows={12}
                      className="w-full p-4 bg-slate-50 border border-blue-400 rounded-xl text-xs font-normal text-slate-900 focus:bg-white focus:outline-none leading-relaxed select-text"
                    />
                  ) : (
                    <div className="text-xs leading-relaxed text-slate-900 font-normal whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200/80 min-h-[260px] max-h-[360px] overflow-y-auto select-text shadow-inner">
                      {selectedOptionTab === 'option1' ? result.option1 : result.option2}
                    </div>
                  )}

                  {/* Action Buttons Bar */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã đồng bộ Sổ tay Chỉ đạo</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard(selectedOptionTab === 'option1' ? result.option1 : result.option2)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                      >
                        {copiedText ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCreateTask(selectedOptionTab === 'option1' ? result.option1 : result.option2)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Giao việc UBND</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 2: VERSIONS HISTORY */}
          {activeRightTab === 'versions' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Lịch Sử Các Bản Soạn Thảo Trong Phiên</span>
                  </h3>
                </div>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md">
                  {draftVersions.length} phiên bản
                </span>
              </div>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {draftVersions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs space-y-1.5">
                    <History className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">Chưa có lịch sử phiên bản</p>
                  </div>
                ) : (
                  draftVersions.map((ver, idx) => (
                    <div 
                      key={ver.id}
                      className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl transition-all space-y-1.5 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
                            {draftVersions.length - idx}
                          </span>
                          <span className="text-xs font-black text-slate-900">{ver.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                          {ver.timestamp}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 line-clamp-2 bg-white p-2 rounded-lg border border-slate-200/60 font-normal">
                        {ver.content}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.2 rounded">
                          {ver.style}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(ver)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Khôi phục</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: NOTEBOOK / FIRESTORE HISTORY */}
          {activeRightTab === 'history' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Sổ Tay Chỉ Đạo Cấp Ủy</span>
                  </h3>
                </div>

                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm chỉ đạo..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* History Items List */}
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs space-y-1.5">
                    <AlertCircle className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">Chưa có dữ liệu nhật ký chỉ đạo</p>
                  </div>
                ) : (
                  filteredHistory.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => handleReuseHistory(item)}
                      className="group p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-xl cursor-pointer transition-all space-y-1.5 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-1.5 py-0.2 bg-white border border-slate-200 text-indigo-900 text-[9px] font-black rounded">
                          {item.style || 'Văn bản kết luận'}
                        </span>
                        
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHistory(item.id, e)}
                          disabled={isDeletingId === item.id}
                          className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title="Xóa"
                        >
                          {isDeletingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>

                      <p className="text-xs font-bold text-slate-900 line-clamp-1">
                        💡 {item.idea}
                      </p>
                      
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                        {item.selectedOptionText}
                      </p>

                      <div className="text-[10px] text-indigo-600 flex items-center justify-between font-bold pt-1 border-t border-slate-200/60">
                        <span className="flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          <span>Nhấp để tải lại mẫu này</span>
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

    </div>
  );
}
