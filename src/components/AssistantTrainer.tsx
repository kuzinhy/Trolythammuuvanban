import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  Sparkles, 
  Brain, 
  Database, 
  Send, 
  Download, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Layers, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  BookOpen, 
  RefreshCw, 
  Lightbulb, 
  HelpCircle,
  FolderDown,
  ShieldCheck,
  Zap,
  Tag
} from 'lucide-react';

export interface FineTuningPair {
  id?: string;
  scenarioTitle: string;
  scenarioContext: string;
  category: string;
  categoryLabel: string;
  urgency: 'HO_TOC' | 'KHAN' | 'THUONG';
  userPrompt: string; // The simulated prompt or question
  expertCompletion: string; // The model answer / golden completion
  authorityRouting: string; // Phân định thẩm quyền BTV vs UBND
  legalBasis: string; // Căn cứ pháp lý
  authorName: string;
  authorEmail?: string;
  status: 'draft' | 'verified' | 'ready_for_finetuning';
  qualityRating: number; // 1 to 5 stars
  systemInstruction?: string;
  createdAt?: any;
  updatedAt?: any;
}

const CATEGORY_OPTIONS = [
  { id: 'THAM_QUYEN_BTV_UBND', label: '🛡️ Phân định Thẩm quyền BTV Đảng ủy vs UBND' },
  { id: 'DON_THU_TIEP_DAN', label: '📢 Đơn thư Khiếu nại, Tố cáo & Tiếp Dân' },
  { id: 'HOA_TOC_DON_DOC', label: '⚡ Xử lý Văn bản Hỏa tốc & Đôn đốc Tiến độ' },
  { id: 'CAN_BO_DANG_VIEN', label: '🎖️ Công tác Cán bộ, Đảng viên & Bảo vệ CTNB' },
  { id: 'QUY_CHE_VAN_PHONG', label: '📋 Thể thức Văn bản & Quy chế Làm việc Cấp ủy' },
  { id: 'KINH_TE_DO_THI_PCCC', label: '🏙️ Quản lý Đất công, Đô thị & An toàn PCCC' },
  { id: 'NGAN_SACH_TAI_CHINH', label: '💰 Quản lý Tài chính, Ngân sách Đảng' }
];

const SAMPLE_SCENARIO_TEMPLATES = [
  {
    title: 'Phân luồng thẩm quyền dự án đầu tư công trên 20 tỷ đồng',
    category: 'THAM_QUYEN_BTV_UBND',
    urgency: 'KHAN' as const,
    context: 'UBND phường tiếp nhận chủ trương đầu tư nâng cấp tuyến đường liên khu phố với tổng kinh phí dự toán 22 tỷ đồng từ nguồn ngân sách Thành phố và nhân dân đóng góp 10%. UBND đề xuất phê duyệt ngay kế hoạch lựa chọn nhà thầu.',
    prompt: 'Văn phòng Đảng ủy cần tham mưu phân định thẩm quyền xem xét chủ trương này theo Quy chế làm việc như thế nào?',
    authorityRouting: 'Ban Thường vụ Đảng ủy xem xét cho chủ trương trước khi UBND phường trình UBND Quận/Thành phố phê duyệt.',
    completion: `1. Về thẩm quyền: Căn cứ Điều 14 Quy chế làm việc Ban Chấp hành Đảng bộ & Ban Thường vụ Đảng ủy, các dự án đầu tư công có tổng mức trên 10 tỷ đồng bắt buộc phải được Ban Thường vụ Đảng ủy xem xét cho chủ trương trước khi chính quyền thực hiện các bước tiếp theo.
2. Về quy trình xử lý:
- Giao UBND phường chuẩn bị Tờ trình chi tiết (đánh giá hiệu quả, nguồn vốn đóng góp của dân, tác động giao thông).
- Văn phòng Đảng ủy thẩm tra thể thức và tham mưu đưa vào Chương trình họp BTV Đảng ủy phiên gần nhất.
- Sau khi có Thông báo Kết luận của Ban Thường vụ Đảng ủy, UBND phường mới được triển khai lập hồ sơ đấu thầu.
3. Dự thảo Bút phê Bí thư: "Chuyển UBND phường hoàn thiện hồ sơ báo cáo Ban Thường vụ Đảng ủy cho chủ trương trong phiên họp ngày 25/08; tuyệt đối không thực hiện quy trình đấu thầu khi chưa có Kết luận của Cấp ủy."`,
    legalBasis: 'Quy chế làm việc Ban Thường vụ Đảng ủy; Luật Đầu tư công 2019; Quy định số 66-QĐ/TW.'
  },
  {
    title: 'Xử lý đơn thư nặc danh phản ánh phẩm chất cán bộ chuẩn bị quy hoạch',
    category: 'CAN_BO_DANG_VIEN',
    urgency: 'KHAN' as const,
    context: 'Văn phòng Đảng ủy nhận được đơn không ghi rõ họ tên, địa chỉ người gửi, phản ánh một đồng chí Đảng ủy viên có dấu hiệu kê khai tài sản không trung thực ngay trước thời điểm rà soát quy hoạch Ban Chấp hành nhiệm kỳ mới.',
    prompt: 'Văn phòng Cấp ủy tham mưu xử lý đơn nặc danh này theo đúng quy định của Đảng ra sao?',
    authorityRouting: 'Thường trực Đảng ủy xem xét; giao Ủy ban Kiểm tra Đảng ủy nắm tình hình, báo cáo Thường trực.',
    completion: `1. Về nguyên tắc xử lý đơn nặc danh: Theo Quy định số 22-QĐ/TW của Ban Chấp hành Trung ương, đơn thư không có tên, không có địa chỉ rõ ràng thì không xem xét, giải quyết theo quy trình giải quyết tố cáo thông thường.
2. Phương án tham mưu:
- Không thụ lý đơn công khai để tránh kẻ xấu lợi dụng bôi nhọ, gây mất đoàn kết nội bộ trước kỳ quy hoạch.
- Tuy nhiên, nếu nội dung đơn có nêu chi tiết cụ thể về tài sản kèm bằng chứng rõ ràng: Văn phòng tham mưu Thường trực Đảng ủy giao UBKT Đảng ủy tiến hành thẩm tra, xác minh độc lập, bí mật để bảo vệ uy tín cán bộ nếu bị vu khống, hoặc xử lý nghiêm nếu có vi phạm.
3. Dự thảo Bút phê: "Chuyển UBKT Đảng ủy chủ trì, phối hợp Ban Tổ chức nắm tình hình, thẩm tra thận trọng theo quy định bảo vệ chính trị nội bộ; báo cáo Thường trực Đảng ủy trước ngày 30/08."`,
    legalBasis: 'Quy định số 22-QĐ/TW về công tác kiểm tra, giám sát và kỷ luật của Đảng; Quy định số 37-QĐ/TW về những điều đảng viên không được làm.'
  },
  {
    title: 'Xử lý văn bản Hỏa tốc của Ban Tuyên giáo Thành ủy yêu cầu định hướng dư luận',
    category: 'HOA_TOC_DON_DOC',
    urgency: 'HO_TOC' as const,
    context: '09h00 sáng nhận Công văn Hỏa tốc từ Ban Tuyên giáo Thành ủy yêu cầu nắm bắt, định hướng dư luận nhân dân về vụ việc tranh chấp tại khu chung cư trên địa bàn và gửi báo cáo nhanh trước 14h00 cùng ngày.',
    prompt: 'Văn phòng Đảng ủy cần kích hoạt quy trình xử lý văn bản hỏa tốc và tham mưu phân công như thế nào?',
    authorityRouting: 'Thường trực Đảng ủy chỉ đạo; Ban Tuyên giáo Đảng ủy phường phối hợp Công an phường thực hiện.',
    completion: `1. Kích hoạt quy trình Văn bản Hỏa tốc:
- Trình ngay Thường trực Đảng ủy (Bí thư/Phó Bí thư Thường trực) trong vòng 15 phút từ khi tiếp nhận.
- Đóng dấu "HỎA TỐC - ĐÔN ĐỐC TIẾN ĐỘ" và lập phiếu luân chuyển ưu tiên số 1.
2. Phân công chủ trì & phối hợp:
- Giao Ban Tuyên giáo Đảng ủy phường chủ trì, phối hợp Công an phường và Cấp ủy Chi bộ khu phố nắm chắc diễn biến dư luận.
- Bộ phận Văn phòng theo dõi, đôn đốc chốt dự thảo Báo cáo lúc 13h00, trình Thường trực ký duyệt lúc 13h30 và phát hành hỏa tốc lên Thành ủy trước 14h00.
3. Dự thảo Bút phê Thường trực: "Giao Ban Tuyên giáo Đảng ủy chủ trì phối hợp Công an phường nắm sát tình hình, hoàn tất Báo cáo gửi Thành ủy trước 13h45 hôm nay; giao Văn phòng trực tiếp đôn đốc."`,
    legalBasis: 'Quy định số 66-QĐ/TW về quy chế làm việc của Văn phòng cấp ủy; Nghị định số 30/2020/NĐ-CP về công tác văn thư.'
  }
];

export default function AssistantTrainer() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [pairs, setPairs] = useState<FineTuningPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'create' | 'dataset' | 'export'>('create');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingPairId, setEditingPairId] = useState<string | null>(null);

  // Form states
  const [scenarioTitle, setScenarioTitle] = useState('');
  const [category, setCategory] = useState('THAM_QUYEN_BTV_UBND');
  const [urgency, setUrgency] = useState<'HO_TOC' | 'KHAN' | 'THUONG'>('KHAN');
  const [scenarioContext, setScenarioContext] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [authorityRouting, setAuthorityRouting] = useState('');
  const [expertCompletion, setExpertCompletion] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  const [qualityRating, setQualityRating] = useState<number>(5);
  const [status, setStatus] = useState<'draft' | 'verified' | 'ready_for_finetuning'>('ready_for_finetuning');

  // Real-time listener for fine-tuning pairs from Firestore collection `ai_training_datasets`
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });

    setLoading(true);
    const q = query(collection(db, 'ai_training_datasets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: FineTuningPair[] = [];
      snapshot.forEach((docSnap) => {
        loaded.push({
          id: docSnap.id,
          ...docSnap.data()
        } as FineTuningPair);
      });
      setPairs(loaded);
      setLoading(false);
    }, (error) => {
      console.warn("Error fetching training pairs from Firestore, using local fallback if offline:", error);
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubscribe();
    };
  }, []);

  const handleApplyTemplate = (template: typeof SAMPLE_SCENARIO_TEMPLATES[0]) => {
    setScenarioTitle(template.title);
    setCategory(template.category);
    setUrgency(template.urgency);
    setScenarioContext(template.context);
    setUserPrompt(template.prompt);
    setAuthorityRouting(template.authorityRouting);
    setExpertCompletion(template.completion);
    setLegalBasis(template.legalBasis);
    setQualityRating(5);
    setStatus('ready_for_finetuning');
  };

  const handleResetForm = () => {
    setScenarioTitle('');
    setCategory('THAM_QUYEN_BTV_UBND');
    setUrgency('KHAN');
    setScenarioContext('');
    setUserPrompt('');
    setAuthorityRouting('');
    setExpertCompletion('');
    setLegalBasis('');
    setQualityRating(5);
    setStatus('ready_for_finetuning');
    setEditingPairId(null);
  };

  const handleEditPair = (pair: FineTuningPair) => {
    setEditingPairId(pair.id || null);
    setScenarioTitle(pair.scenarioTitle || '');
    setCategory(pair.category || 'THAM_QUYEN_BTV_UBND');
    setUrgency(pair.urgency || 'KHAN');
    setScenarioContext(pair.scenarioContext || '');
    setUserPrompt(pair.userPrompt || '');
    setAuthorityRouting(pair.authorityRouting || '');
    setExpertCompletion(pair.expertCompletion || '');
    setLegalBasis(pair.legalBasis || '');
    setQualityRating(pair.qualityRating || 5);
    setStatus(pair.status || 'ready_for_finetuning');
    setActiveTab('create');
  };

  const handleSubmitPair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioTitle.trim() || !expertCompletion.trim()) {
      alert("Vui lòng nhập đầy đủ Tiêu đề tình huống và Câu trả lời / Phương án tham mưu chuẩn mực!");
      return;
    }

    setSaving(true);
    const catObj = CATEGORY_OPTIONS.find(c => c.id === category);

    const pairData: Omit<FineTuningPair, 'id'> = {
      scenarioTitle: scenarioTitle.trim(),
      scenarioContext: scenarioContext.trim(),
      category,
      categoryLabel: catObj ? catObj.label : category,
      urgency,
      userPrompt: userPrompt.trim() || `Tình huống: ${scenarioTitle}. Hãy tham mưu thẩm quyền, quy trình xử lý và dự thảo bút phê chuẩn theo Quy chế Cấp ủy.`,
      authorityRouting: authorityRouting.trim(),
      expertCompletion: expertCompletion.trim(),
      legalBasis: legalBasis.trim() || 'Quy chế làm việc Ban Chấp hành & BTV Đảng ủy, Quy định 66-QĐ/TW',
      authorName: currentUser?.displayName || currentUser?.email || 'Chuyên viên Tham mưu Cấp ủy',
      authorEmail: currentUser?.email || '',
      status,
      qualityRating,
      systemInstruction: 'Bạn là Trợ lý Tham mưu Trưởng Văn phòng Cấp ủy (Đảng ủy Phường/Xã/Quận). Hãy trả lời chuẩn xác theo Điều lệ Đảng, Quy chế làm việc Ban Thường vụ, Nghị định 30/2020/NĐ-CP và thẩm quyền phân luồng chính quyền.',
      updatedAt: serverTimestamp()
    };

    try {
      if (editingPairId) {
        const docRef = doc(db, 'ai_training_datasets', editingPairId);
        await updateDoc(docRef, {
          ...pairData
        });
      } else {
        await addDoc(collection(db, 'ai_training_datasets'), {
          ...pairData,
          createdAt: serverTimestamp()
        });
      }

      handleResetForm();
      setActiveTab('dataset');
    } catch (err: any) {
      console.error("Failed to save fine-tuning pair to Firestore:", err);
      alert("Lỗi khi lưu dữ liệu vào Firestore: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePair = async (id?: string) => {
    if (!id) return;
    if (!window.confirm("Đồng chí có chắc chắn muốn xóa cặp dữ liệu huấn luyện này khỏi Firestore?")) return;

    try {
      await deleteDoc(doc(db, 'ai_training_datasets', id));
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Không thể xóa dữ liệu.");
    }
  };

  // Export dataset to OpenAI / Gemini JSONL format
  const exportToJSONL = () => {
    if (pairs.length === 0) {
      alert("Chưa có cặp dữ liệu nào để xuất.");
      return;
    }

    const jsonlLines = pairs.map(p => {
      const systemPrompt = p.systemInstruction || 'Bạn là Trợ lý Tham mưu Trưởng Văn phòng Cấp ủy (Đảng ủy Phường/Xã). Hãy tham mưu chuẩn xác thẩm quyền Ban Thường vụ vs UBND, quy trình xử lý văn bản và dự thảo bút phê.';
      const fullUserContent = `BỐI CẢNH TÌNH HUỐNG: ${p.scenarioContext || p.scenarioTitle}\nYÊU CẦU THAM MƯU: ${p.userPrompt}\nĐỘ KHẨN: ${p.urgency}`;
      
      return JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullUserContent },
          { role: 'assistant', content: p.expertCompletion }
        ]
      });
    });

    const blob = new Blob([jsonlLines.join('\n')], { type: 'application/jsonl;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dataset_finetuning_party_office_${new Date().toISOString().slice(0,10)}.jsonl`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export dataset to standard JSON
  const exportToJSON = () => {
    if (pairs.length === 0) {
      alert("Chưa có cặp dữ liệu nào để xuất.");
      return;
    }

    const blob = new Blob([JSON.stringify(pairs, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `party_office_ai_training_dataset_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredPairs = pairs.filter(p => {
    const matchCategory = selectedFilterCategory === 'ALL' || p.category === selectedFilterCategory;
    const matchQuery = !searchQuery.trim() || 
      p.scenarioTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.scenarioContext.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.expertCompletion.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchQuery;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 -mb-16 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-amber-400 text-slate-950 text-xs font-black rounded-lg uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Brain className="w-3.5 h-3.5" />
                <span>Fine-Tuning Studio</span>
              </span>
              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-200 text-xs font-bold rounded-md border border-blue-400/30">
                Firestore Collection: <code className="text-amber-300 font-mono">ai_training_datasets</code>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Huấn Luyện Trợ Lý AI: Tạo Tập Dữ Liệu Tình Huống Giả Định & Lời Giải Mẫu
            </h1>

            <p className="text-xs sm:text-sm text-indigo-200 font-medium leading-relaxed max-w-3xl">
              Nhập các tình huống nghiệp vụ văn phòng cấp ủy giả định (Prompt) kèm lời giải mẫu chuẩn mực (Target Completion) của Lãnh đạo và Chuyên viên Cấp ủy. Dữ liệu được đồng bộ trực tiếp vào Firestore để phục vụ Fine-tuning và nạp vào Bộ Não AI tham mưu.
            </p>
          </div>

          <div className="lg:col-span-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-indigo-100">
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-400" />
                <span>Quy mô Tập Dữ Liệu:</span>
              </span>
              <span className="text-base font-black text-amber-300">{pairs.length} cặp mẫu</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
              <div className="bg-slate-900/60 p-2 rounded-xl border border-white/10">
                <div className="font-black text-emerald-400">{pairs.filter(p => p.status === 'ready_for_finetuning').length}</div>
                <div className="text-slate-400 text-[10px]">Sẵn sàng Train</div>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-xl border border-white/10">
                <div className="font-black text-amber-400">{pairs.filter(p => p.qualityRating === 5).length}</div>
                <div className="text-slate-400 text-[10px]">Chuẩn 5 Sao</div>
              </div>
            </div>

            <div className="pt-1 flex gap-2">
              <button
                onClick={exportToJSONL}
                disabled={pairs.length === 0}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất File JSONL</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setActiveTab('create'); setEditingPairId(null); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>{editingPairId ? '✏️ Đang chỉnh sửa cặp dữ liệu' : '➕ Thêm Cặp Huấn Luyện Mới'}</span>
          </button>

          <button
            onClick={() => setActiveTab('dataset')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'dataset'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>📋 Danh Sách Cặp Dữ Liệu Trong Firestore ({pairs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FolderDown className="w-4 h-4 text-amber-400" />
            <span>📦 Xuất Định Dạng Fine-Tuning (JSONL / JSON)</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: CREATE / EDIT PAIR */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Quick Template Suggestions */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 p-5 rounded-3xl border border-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-amber-950 font-black text-xs uppercase tracking-wide">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                <span>Tình huống mẫu tham khảo (1-Click điền nhanh)</span>
              </div>
              <p className="text-xs text-amber-900/80 font-medium">
                Chọn một tình huống thực tế mẫu dưới đây để tự động điền các trường, sau đó chỉnh sửa theo quy chế của đơn vị:
              </p>

              <div className="space-y-2.5 pt-1">
                {SAMPLE_SCENARIO_TEMPLATES.map((tmpl, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="p-3.5 bg-white hover:bg-amber-100/50 rounded-2xl border border-amber-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        Mẫu {idx + 1}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {tmpl.urgency === 'HO_TOC' ? '⚡ Hỏa tốc' : 'Khẩn'}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {tmpl.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 font-medium">
                      {tmpl.context}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2 font-medium">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Tiêu chuẩn dữ liệu Fine-tuning Cấp ủy</span>
              </div>
              <p>
                • <strong>Prompt (Input):</strong> Nêu rõ chủ thể, bối cảnh văn bản, số tiền/đối tượng, cấp ban hành và câu hỏi tham mưu trọng tâm.
              </p>
              <p>
                • <strong>Completion (Output):</strong> Trả lời theo cấu trúc 3 phần: (1) Thẩm quyền; (2) Phân luồng đơn vị chủ trì/phối hợp; (3) Dự thảo mẫu Bút phê hoặc Thông báo kết luận.
              </p>
            </div>
          </div>

          {/* Right Column: Training Input Form */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSubmitPair} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">
                    {editingPairId ? 'Chỉnh Sửa Cặp Dữ Liệu Huấn Luyện' : 'Nhập Tình Huống Giả Định & Lời Giải Mẫu'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dữ liệu sẽ được lưu vào Firestore collection <code className="text-blue-600 font-bold">ai_training_datasets</code>
                  </p>
                </div>

                {editingPairId && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-xs text-rose-600 font-bold hover:underline"
                  >
                    Hủy chỉnh sửa
                  </button>
                )}
              </div>

              {/* 1. Title & Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Tiêu đề tình huống giả định <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={scenarioTitle}
                    onChange={(e) => setScenarioTitle(e.target.value)}
                    placeholder="VD: Xử lý kiến nghị giải phóng mặt bằng đường trục chính..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Mức độ khẩn cấp:
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="HO_TOC">⚡ HỎA TỐC (Xử lý trong 4h)</option>
                    <option value="KHAN">🔥 KHẨN (Xử lý trong 24h)</option>
                    <option value="THUONG">📋 THƯỜNG (Xử lý theo lịch)</option>
                  </select>
                </div>
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Chuyên đề nghiệp vụ / Danh mục:
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Trạng thái dữ liệu:
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="ready_for_finetuning">✅ Sẵn sàng Fine-Tuning</option>
                    <option value="verified">🛡️ Đã chuyên viên kiểm duyệt</option>
                    <option value="draft">📝 Bản thảo nháp</option>
                  </select>
                </div>
              </div>

              {/* 2. Scenario Context */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Bối cảnh tình huống thực tế (Background Context / Details):
                </label>
                <textarea
                  rows={3}
                  value={scenarioContext}
                  onChange={(e) => setScenarioContext(e.target.value)}
                  placeholder="Mô tả chi tiết sự việc, văn bản gửi đến từ cơ quan nào, số liệu liên quan, các mâu thuẫn cần tháo gỡ..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none leading-relaxed"
                />
              </div>

              {/* 3. Simulated User Prompt / Question */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Câu hỏi / Yêu cầu tham mưu giả định (Simulated Prompt / Input):
                </label>
                <input
                  type="text"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="VD: Văn phòng Đảng ủy cần tham mưu thẩm quyền xem xét và dự thảo bút phê của Bí thư như thế nào?"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* 4. Expert Golden Completion */}
              <div className="space-y-1 bg-blue-50/60 p-4 rounded-2xl border border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Câu trả lời / Lời giải tham mưu chuẩn mực (Target Golden Completion) <span className="text-rose-500">*</span>:</span>
                  </label>
                  <span className="text-[10px] font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                    Mẫu để AI học tập
                  </span>
                </div>
                <textarea
                  rows={6}
                  required
                  value={expertCompletion}
                  onChange={(e) => setExpertCompletion(e.target.value)}
                  placeholder="Nhập phương án tham mưu chuẩn mực gồm: (1) Thẩm quyền giải quyết; (2) Phân công cơ quan chủ trì & phối hợp; (3) Mẫu dự thảo Bút phê Bí thư hoặc Kết luận Cấp ủy..."
                  className="w-full px-3.5 py-2.5 bg-white border border-blue-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none leading-relaxed font-sans text-slate-900"
                />
              </div>

              {/* 5. Legal Basis & Authority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Phân định Thẩm quyền (Tóm tắt):
                  </label>
                  <input
                    type="text"
                    value={authorityRouting}
                    onChange={(e) => setAuthorityRouting(e.target.value)}
                    placeholder="VD: BTV Đảng ủy cho chủ trương, UBND tổ chức thực hiện..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Căn cứ pháp lý & Quy chế:
                  </label>
                  <input
                    type="text"
                    value={legalBasis}
                    onChange={(e) => setLegalBasis(e.target.value)}
                    placeholder="VD: Quy chế làm việc BTV, Quy định 66-QĐ/TW, NĐ 30/2020..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                <div className="text-xs text-slate-500 font-medium">
                  Người đóng góp: <strong className="text-slate-800">{currentUser?.displayName || currentUser?.email || 'Chuyên viên Cấp ủy'}</strong>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Làm mới form
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-amber-300" />}
                    <span>{saving ? 'Đang gửi vào Firestore...' : editingPairId ? 'Cập Nhật Cặp Dữ Liệu' : '💾 Lưu Vào Firestore Để Fine-Tuning'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW 2: DATASET BROWSER IN FIRESTORE */}
      {activeTab === 'dataset' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase">
                Tập Dữ Liệu Huấn Luyện Trong Firestore ({filteredPairs.length} / {pairs.length} cặp)
              </h3>
              <p className="text-xs text-slate-500">
                Các cặp Prompt - Completion chuẩn mực được lưu trữ tại collection <code className="text-blue-600 font-bold">ai_training_datasets</code>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={exportToJSONL}
                disabled={pairs.length === 0}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất JSONL</span>
              </button>
              <button
                onClick={exportToJSON}
                disabled={pairs.length === 0}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất JSON</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tiêu đề tình huống, nội dung hoặc câu trả lời mẫu..."
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-5">
              <select
                value={selectedFilterCategory}
                onChange={(e) => setSelectedFilterCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="ALL">Tất cả chuyên đề ({pairs.length})</option>
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({pairs.filter(p => p.category === c.id).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* List of Pairs */}
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className="text-xs font-medium">Đang tải tập dữ liệu huấn luyện từ Firestore...</p>
            </div>
          ) : filteredPairs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Database className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Chưa có cặp dữ liệu nào phù hợp</p>
              <button
                onClick={() => { setActiveTab('create'); }}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              >
                Tạo cặp dữ liệu đầu tiên
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPairs.map((pair, idx) => (
                <div 
                  key={pair.id || idx}
                  className="bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-black rounded-md border border-blue-200">
                          {pair.categoryLabel || pair.category}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${
                          pair.urgency === 'HO_TOC' 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {pair.urgency === 'HO_TOC' ? '⚡ HỎA TỐC' : pair.urgency === 'KHAN' ? '🔥 KHẨN' : '📋 THƯỜNG'}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                          ⭐ {pair.qualityRating || 5} Sao
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900">
                        {pair.scenarioTitle}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditPair(pair)}
                        className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Chỉnh sửa"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Sửa</span>
                      </button>
                      <button
                        onClick={() => handleDeletePair(pair.id)}
                        className="p-2 bg-white hover:bg-rose-50 text-rose-600 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Xóa khỏi Firestore"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Xóa</span>
                      </button>
                    </div>
                  </div>

                  {pair.scenarioContext && (
                    <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80 font-medium leading-relaxed">
                      <strong className="text-slate-800">Bối cảnh:</strong> {pair.scenarioContext}
                    </div>
                  )}

                  <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200/80 space-y-1.5 text-xs">
                    <div className="font-bold text-blue-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Lời giải mẫu (Golden Completion):</span>
                    </div>
                    <p className="text-slate-800 whitespace-pre-line font-medium leading-relaxed">
                      {pair.expertCompletion}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span>⚖️ <strong>Căn cứ:</strong> {pair.legalBasis || 'Quy chế cấp ủy'}</span>
                      {pair.authorityRouting && <span>🛡️ <strong>Thẩm quyền:</strong> {pair.authorityRouting}</span>}
                    </div>
                    <div>
                      <span>Tác giả: <strong>{pair.authorName}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: EXPORT & FINE-TUNING PREVIEW */}
      {activeTab === 'export' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-black text-slate-900 uppercase">
              Xuất Tập Dữ Liệu Chuẩn Fine-Tuning & Tích Hợp Mô Hình
            </h3>
            <p className="text-xs text-slate-500">
              Tải về định dạng chuẩn để nạp vào hệ thống huấn luyện hoặc lưu trữ vào Google Drive
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded uppercase">
                  Định dạng chuẩn OpenAI / Gemini
                </span>
                <span className="text-xs font-bold text-amber-900">{pairs.length} mẫu</span>
              </div>
              <h4 className="text-sm font-black text-slate-900">File JSONL (Chat Completion Format)</h4>
              <p className="text-xs text-slate-600 font-medium">
                Cấu trúc dạng <code className="bg-white px-1 py-0.5 rounded border border-amber-200 text-amber-900 font-mono">{'{"messages": [{"role": "system"}, {"role": "user"}, {"role": "assistant"}]}'}</code> trên mỗi dòng.
              </p>
              <button
                onClick={exportToJSONL}
                disabled={pairs.length === 0}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Tải Tập Tin JSONL</span>
              </button>
            </div>

            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded uppercase">
                  Sao lưu & Phân tích
                </span>
                <span className="text-xs font-bold text-blue-900">{pairs.length} mẫu</span>
              </div>
              <h4 className="text-sm font-black text-slate-900">File JSON Đầy Đủ Metadata</h4>
              <p className="text-xs text-slate-600 font-medium">
                Chứa toàn bộ trường dữ liệu Firestore, thông tin tác giả, căn cứ pháp lý, chuyên đề và trạng thái duyệt.
              </p>
              <button
                onClick={exportToJSON}
                disabled={pairs.length === 0}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Tải Tập Tin JSON</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl space-y-2 font-mono text-xs overflow-x-auto">
            <div className="text-amber-400 font-bold text-[11px] uppercase tracking-wider">
              // Xem trước 01 dòng mẫu định dạng JSONL:
            </div>
            <pre className="text-slate-300 text-[11px] leading-relaxed whitespace-pre-wrap">
              {pairs.length > 0 ? JSON.stringify({
                messages: [
                  { role: 'system', content: pairs[0].systemInstruction || 'Bạn là Trợ lý Tham mưu Trưởng Văn phòng Cấp ủy...' },
                  { role: 'user', content: `BỐI CẢNH: ${pairs[0].scenarioContext}\nYÊU CẦU: ${pairs[0].userPrompt}` },
                  { role: 'assistant', content: pairs[0].expertCompletion }
                ]
              }, null, 2) : '// Chưa có dữ liệu trong Firestore. Hãy thêm cặp dữ liệu tại tab "Thêm Cặp Huấn Luyện Mới".'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
