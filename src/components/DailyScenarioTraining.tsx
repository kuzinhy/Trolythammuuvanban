import React, { useState, useEffect } from 'react';
import { 
  DAILY_SCENARIOS_BANK, 
  ScenarioItem, 
  ScenarioOption, 
  ContributorProfile, 
  ScenarioReviewSubmission, 
  LearningRule,
  getContributorProfile, 
  saveContributorProfile, 
  getSubmittedReviews, 
  submitScenarioReview,
  getActiveLearningRules
} from '../lib/learningEngine';
import { safeFetchJson } from '../lib/safeFetch';
import { 
  Sparkles, 
  Star, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  Send, 
  Brain, 
  RefreshCw, 
  HelpCircle, 
  ChevronRight, 
  ShieldCheck, 
  FileText, 
  Flame, 
  ThumbsUp, 
  Layers, 
  Check, 
  ArrowRight,
  TrendingUp,
  Zap,
  Plus
} from 'lucide-react';

interface DailyScenarioTrainingProps {
  onRuleAdded?: (newRule: LearningRule) => void;
}

export default function DailyScenarioTraining({ onRuleAdded }: DailyScenarioTrainingProps) {
  const [scenarios, setScenarios] = useState<ScenarioItem[]>(DAILY_SCENARIOS_BANK);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeScenarioId, setActiveScenarioId] = useState<string>(DAILY_SCENARIOS_BANK[0].id);
  
  // Profile & Reviews state
  const [profile, setProfile] = useState<ContributorProfile>(getContributorProfile());
  const [submittedReviews, setSubmittedReviews] = useState<ScenarioReviewSubmission[]>(getSubmittedReviews());
  const [learnedRules, setLearnedRules] = useState<LearningRule[]>([]);
  
  // Form submission state
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [customDirective, setCustomDirective] = useState<string>('');
  const [customRouting, setCustomRouting] = useState<string>('');
  const [keywordTrigger, setKeywordTrigger] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>('Đồng chí Lãnh đạo / Cán bộ Tham mưu');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDetails, setCelebrationDetails] = useState<{ points: number; rule: string } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'training' | 'rules_feed' | 'ranking'>('training');

  const currentScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  const isCurrentReviewed = submittedReviews.some(r => r.scenarioId === currentScenario?.id);

  // Initialize form when scenario changes
  useEffect(() => {
    if (currentScenario) {
      const bestOption = currentScenario.options.find(o => o.isRecommendedByPolicy) || currentScenario.options[0];
      setSelectedOptionId(bestOption?.id || '');
      setCustomDirective(currentScenario.defaultAiAdvice.suggestedDirective);
      setCustomRouting(bestOption?.leadDept || currentScenario.defaultAiAdvice.suggestedRouting);
      setKeywordTrigger(currentScenario.keywordTriggers);
      setRating(5);
    }
  }, [activeScenarioId]);

  // Load learned rules
  useEffect(() => {
    async function loadRules() {
      const rules = await getActiveLearningRules();
      setLearnedRules(rules);
    }
    loadRules();
  }, []);

  const filteredScenarios = scenarios.filter(s => {
    if (selectedCategory === 'ALL') return true;
    return s.category === selectedCategory;
  });

  // Generate dynamic scenario with AI
  const handleGenerateNewScenario = async () => {
    setIsGeneratingNew(true);
    try {
      const res = await safeFetchJson<{ scenario: ScenarioItem }>('/api/generate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory !== 'ALL' ? selectedCategory : undefined })
      });
      if (res.ok && res.data?.scenario?.title) {
        setScenarios(prev => [res.data.scenario, ...prev]);
        setActiveScenarioId(res.data.scenario.id);
      }
    } catch (err) {
      console.error('Error generating scenario:', err);
    } finally {
      setIsGeneratingNew(false);
    }
  };

  // Submit Review & Teach AI (Google Maps Review Style)
  const handleSubmitReview = async () => {
    if (!currentScenario) return;
    setIsSubmitting(true);

    try {
      const result = await submitScenarioReview({
        scenarioId: currentScenario.id,
        scenarioTitle: currentScenario.title,
        rating,
        selectedOptionId,
        customDirective: customDirective.trim() || currentScenario.defaultAiAdvice.suggestedDirective,
        customRouting: customRouting.trim() || 'Văn phòng Đảng ủy & UBND',
        keywordTrigger: keywordTrigger.trim() || currentScenario.keywordTriggers,
        reviewerName: reviewerName.trim() || 'Cán bộ Tham mưu'
      });

      setProfile(result.updatedProfile);
      setSubmittedReviews(getSubmittedReviews());
      setLearnedRules(prev => [result.newRule, ...prev]);

      if (onRuleAdded) {
        onRuleAdded(result.newRule);
      }

      setCelebrationDetails({
        points: result.submission.pointsEarned,
        rule: result.newRule.keywordTrigger
      });
      setShowCelebration(true);
    } catch (err) {
      console.error('Error submitting review:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5: return '⭐⭐⭐⭐⭐ Xuất sắc (Chuẩn tuyệt đối Quy chế Cấp ủy)';
      case 4: return '⭐⭐⭐⭐ Khá tốt (Đúng thẩm quyền, cần bổ sung chi tiết)';
      case 3: return '⭐⭐⭐ Trung bình (Đạt yêu cầu cơ bản, cần chỉnh sửa)';
      case 2: return '⭐⭐ Chưa đạt (Dễ gây chồng chéo thẩm quyền)';
      case 1: return '⭐ Sai lệch (Không đúng quy chế làm việc của Đảng)';
      default: return 'Chọn mức độ đánh giá';
    }
  };

  // Points target calculation
  const nextLevelPoints = profile.level === 1 ? 40 : profile.level === 2 ? 100 : profile.level === 3 ? 200 : profile.level === 4 ? 300 : 500;
  const progressPercent = Math.min(100, Math.round((profile.totalPoints / nextLevelPoints) * 100));

  return (
    <div className="space-y-6">
      {/* 1. GOOGLE MAPS STYLE LOCAL CONTRIBUTOR PROFILE CARD */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-blue-700/50 relative overflow-hidden">
        {/* Glow effect background */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-16 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Contributor Badge & Level */}
          <div className="lg:col-span-4 flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 p-0.5 shadow-lg flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex flex-col items-center justify-center text-amber-300">
                  <Award className="w-7 h-7" />
                  <span className="text-[10px] font-black tracking-wider">CẤP {profile.level}</span>
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-[10px] font-black rounded-md border border-amber-400/30 uppercase">
                  Google Maps Style Contributor
                </span>
              </div>
              <h2 className="text-lg font-black text-white">{profile.levelName}</h2>
              <p className="text-xs text-blue-200">{profile.name}</p>
            </div>
          </div>

          {/* Middle: Progress Bar to next level */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex justify-between text-xs font-bold text-blue-100">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Điểm Tri Thức: <strong className="text-amber-300">{profile.totalPoints}</strong> / {nextLevelPoints} pts</span>
              </span>
              <span className="text-emerald-300">{progressPercent}% thăng cấp</span>
            </div>
            
            <div className="w-full bg-slate-800/80 rounded-full h-2.5 p-0.5 border border-white/10">
              <div 
                className="bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-300 h-full rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {profile.badges.map((b, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-white/10 hover:bg-white/15 text-blue-100 text-[10px] font-bold rounded-md border border-white/15 backdrop-blur-xs transition-colors">
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Quick Stats */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-2 text-center bg-white/5 p-3 rounded-2xl border border-white/10 backdrop-blur-xs">
            <div className="p-1.5">
              <div className="text-xl font-black text-amber-300">{profile.totalReviews}</div>
              <div className="text-[10px] font-bold text-slate-300 uppercase">Tình huống đã luyện</div>
            </div>
            <div className="p-1.5 border-l border-white/10">
              <div className="text-xl font-black text-emerald-300">{learnedRules.length}</div>
              <div className="text-[10px] font-bold text-slate-300 uppercase">Quy tắc AI nạp</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('training')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'training'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Brain className="w-4 h-4 text-amber-300" />
            <span>🎯 Luyện Não Tình Huống Hàng Ngày</span>
          </button>

          <button
            onClick={() => setActiveSubTab('rules_feed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'rules_feed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>🧠 Kho Quy Tắc AI Đã Học ({learnedRules.length})</span>
          </button>
        </div>

        <button
          onClick={handleGenerateNewScenario}
          disabled={isGeneratingNew}
          className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          {isGeneratingNew ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 text-amber-300" />}
          <span>{isGeneratingNew ? 'AI đang tạo tình huống mới...' : 'Tạo Tình huống Mới bằng AI'}</span>
        </button>
      </div>

      {/* 3. MAIN TRAINING VIEW */}
      {activeSubTab === 'training' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Category Filter & Scenario Directory */}
          <div className="lg:col-span-4 space-y-4">
            {/* Category Pills */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                Chuyên đề Cấp ủy & Chính quyền
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'THAM_QUYEN_BTV_UBND', label: '🛡️ Thẩm quyền BTV/UBND' },
                  { id: 'DON_THU_KHIẾU_NẠI', label: '📢 Đơn thư & Tiếp dân' },
                  { id: 'HOA_TOC_CHI_DAO', label: '⚡ Hỏa tốc & Khẩn' },
                  { id: 'TRAT_TU_DO_THI', label: '🏙️ Đô thị & PCCC' },
                  { id: 'TO_CHUC_DANG_VIEN', label: '🎖️ Cán bộ & Đảng viên' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scenarios List */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {filteredScenarios.map((sc, idx) => {
                const isSelected = sc.id === activeScenarioId;
                const isDone = submittedReviews.some(r => r.scenarioId === sc.id);

                return (
                  <div
                    key={sc.id}
                    onClick={() => setActiveScenarioId(sc.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${
                        sc.urgency === 'HO_TOC' 
                          ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {sc.urgencyLabel}
                      </span>

                      {isDone ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Đã đóng góp</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                          <span>Chưa luyện</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <h3 className={`text-xs font-bold line-clamp-2 ${isSelected ? 'text-blue-950' : 'text-slate-800'}`}>
                      {sc.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-1 font-medium">
                      {sc.categoryLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Scenario Review & Google Maps Style Training Console */}
          <div className="lg:col-span-8 space-y-6">
            {currentScenario && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                {/* Header of Scenario */}
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-900 text-xs font-black rounded-lg border border-blue-200">
                      {currentScenario.categoryLabel}
                    </span>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 text-xs font-black rounded-lg border border-amber-200">
                      ⚡ Độ khẩn: {currentScenario.urgencyLabel}
                    </span>
                  </div>

                  <h2 className="text-base md:text-lg font-black text-slate-900">
                    {currentScenario.title}
                  </h2>
                </div>

                {/* Bối cảnh thực tế */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wide">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Bối cảnh tình huống thực tế</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {currentScenario.background}
                  </p>
                  <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs font-bold text-blue-950 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Yêu cầu tham mưu: {currentScenario.keyQuestion}</span>
                  </div>
                </div>

                {/* Đề xuất tham mưu ban đầu của AI */}
                <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/60 p-4 rounded-2xl border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-black text-indigo-950 uppercase">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Tham mưu đề xuất ban đầu của AI Cấp ủy</span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-white/80 px-2 py-0.5 rounded-md border border-indigo-200">
                      Google Drive Grounded
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-800">
                    <div>
                      <strong className="text-indigo-950">Phân định Thẩm quyền:</strong> {currentScenario.defaultAiAdvice.authority}
                    </div>
                    <div>
                      <strong className="text-indigo-950">Phân luồng thực hiện:</strong> {currentScenario.defaultAiAdvice.suggestedRouting}
                    </div>
                    <div>
                      <strong className="text-indigo-950">Dự thảo Bút phê/Ý kiến:</strong> <span className="italic font-serif text-slate-900 bg-white/70 px-2 py-0.5 rounded border border-indigo-100 inline-block">"{currentScenario.defaultAiAdvice.suggestedDirective}"</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {currentScenario.defaultAiAdvice.legalBasis.map((lb, i) => (
                      <span key={i} className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        ⚖️ {lb}
                      </span>
                    ))}
                  </div>
                </div>

                {/* GOOGLE MAPS STYLE REVIEW & TRAINING FORM */}
                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase">
                        Đánh giá & Dạy Bộ Não AI (Google Maps Review Style)
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Đóng góp ý kiến và phương án chuẩn mực của Đồng chí để nạp vĩnh viễn vào Bộ Não AI
                      </p>
                    </div>
                  </div>

                  {/* 1. Star Rating */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      1. Đồng chí đánh giá mức độ chính xác của AI ở thang điểm nào?
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 text-slate-300 hover:scale-125 transition-transform cursor-pointer"
                          >
                            <Star
                              className={`w-6 h-6 ${
                                (hoverRating || rating) >= star
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200">
                        {getRatingLabel(hoverRating || rating)}
                      </span>
                    </div>
                  </div>

                  {/* 2. Selection of best solution */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      2. Chọn phương án xử lý theo chuẩn Quy chế:
                    </label>
                    <div className="space-y-2">
                      {currentScenario.options.map(opt => (
                        <label
                          key={opt.id}
                          className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                            selectedOptionId === opt.id
                              ? 'bg-blue-50 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="scenarioOption"
                            value={opt.id}
                            checked={selectedOptionId === opt.id}
                            onChange={() => {
                              setSelectedOptionId(opt.id);
                              setCustomRouting(opt.leadDept);
                              setCustomDirective(opt.action);
                            }}
                            className="mt-1 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                              {opt.isRecommendedByPolicy && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded">
                                  ✓ Chuẩn Quy chế
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium">
                              <strong>Phân luồng:</strong> {opt.leadDept} — {opt.action}
                            </p>
                            <p className="text-[10px] text-slate-500 italic">
                              💡 {opt.explanation}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 3. Custom Directive & Ruling Formulation */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      3. Ý kiến chỉ đạo / Mẫu bút phê chuẩn của Đồng chí để AI học:
                    </label>
                    <textarea
                      rows={3}
                      value={customDirective}
                      onChange={(e) => setCustomDirective(e.target.value)}
                      placeholder="Nhập nội dung ý kiến chỉ đạo, bút phê mẫu hoặc bài học kinh nghiệm của Đồng chí..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  {/* 4. Trigger Keywords */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Cơ quan chủ trì đề xuất:
                      </label>
                      <input
                        type="text"
                        value={customRouting}
                        onChange={(e) => setCustomRouting(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Từ khóa kích hoạt quy tắc máy học (Triggers):
                      </label>
                      <input
                        type="text"
                        value={keywordTrigger}
                        onChange={(e) => setKeywordTrigger(e.target.value)}
                        placeholder="VD: đất công, bãi xe, quy hoạch..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Action submit */}
                  <div className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-[11px] text-slate-500 font-medium">
                      ⚡ Mỗi đánh giá hợp lệ sẽ cộng <strong className="text-amber-600 font-bold">+25 Điểm Tri Thức</strong> và nạp trực tiếp vào Bộ Não AI.
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmitReview}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4 text-amber-300" />}
                      <span>{isSubmitting ? 'Đang nạp vào bộ não AI...' : '⭐ Đóng Góp Đánh Giá & Nạp Tri Thức (+25 Điểm)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. RULES FEED VIEW (AI Brain Blueprint) */}
      {activeSubTab === 'rules_feed' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase">
                Bộ Não AI Tri Thức Cấp Ủy: Quy Tắc Đã Học ({learnedRules.length})
              </h3>
              <p className="text-xs text-slate-500">
                Các quy tắc tham mưu được đúc kết từ đóng góp thực tế và đồng bộ cùng Thư mục Google Drive
              </p>
            </div>

            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-lg border border-emerald-300">
              Đồng bộ 100% vào Chat & Phân luồng
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {learnedRules.map((r, i) => (
              <div key={r.id || i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-black rounded border border-blue-200">
                    Từ khóa: {r.keywordTrigger}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    Độ tin cậy: {r.confidence}%
                  </span>
                </div>

                <div className="text-xs text-slate-800 space-y-1">
                  <div>
                    <strong className="text-slate-900">Đơn vị chủ trì:</strong> {r.suggestedLeadDept}
                  </div>
                  <div>
                    <strong className="text-slate-900">Đề xuất chỉ đạo:</strong> {r.suggestedAction}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex justify-between">
                  <span>💡 {r.notes || 'Quy tắc máy học'}</span>
                  <span>{r.learnedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. CELEBRATION MODAL (Gamified Reward Pop-up) */}
      {showCelebration && celebrationDetails && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-white mx-auto flex items-center justify-center shadow-lg">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-black rounded-full uppercase">
                +{celebrationDetails.points} Điểm Đóng Góp Tri Thức!
              </span>
              <h3 className="text-lg font-black text-slate-900 pt-2">
                Bộ Não AI Đã Thông Minh Hơn!
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Ý kiến đóng góp chuẩn mực của Đồng chí đã được ghi nhận và nạp thành quy tắc máy học mới cho toàn bộ hệ thống Văn phòng Cấp ủy.
              </p>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-left text-xs space-y-1">
              <div className="font-bold text-blue-950">Quy tắc vừa ghi nhớ:</div>
              <div className="text-slate-700">Khi gặp văn bản chứa <strong>[{celebrationDetails.rule}]</strong>, AI sẽ ưu tiên phương án chỉ đạo của Đồng chí.</div>
            </div>

            <button
              onClick={() => setShowCelebration(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
            >
              Tiếp tục Luyện Não & Đóng góp Tình huống
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
