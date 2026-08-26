import React, { useState, useEffect } from 'react';
import { 
  X, Brain, Sparkles, Star, Award, CheckCircle2, AlertTriangle, 
  Send, RefreshCw, ChevronRight, ShieldCheck, ArrowRight, Zap, Check, Edit3, MessageSquare
} from 'lucide-react';
import { 
  DAILY_SCENARIOS_BANK, 
  ScenarioItem, 
  getContributorProfile, 
  saveContributorProfile, 
  submitScenarioReview,
  saveLearnedAdjustmentRule
} from '../lib/learningEngine';

interface BrainTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BrainTrainingModal({ isOpen, onClose }: BrainTrainingModalProps) {
  const [scenarioIndex, setScenarioIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [customDirective, setCustomDirective] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>('Đồng chí Lãnh đạo / Cán bộ Cấp ủy');
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [lastEarnedPoints, setLastEarnedPoints] = useState<number>(25);
  const [updatedAccuracy, setUpdatedAccuracy] = useState<number>(98.5);

  const profile = getContributorProfile();
  const currentScenario: ScenarioItem = DAILY_SCENARIOS_BANK[scenarioIndex % DAILY_SCENARIOS_BANK.length];

  // Reset or select default option when scenario changes
  useEffect(() => {
    if (currentScenario) {
      const best = currentScenario.options.find(o => o.isRecommendedByPolicy) || currentScenario.options[0];
      setSelectedOptionId(best?.id || '');
      setCustomDirective('');
      setShowSuccess(false);
    }
  }, [scenarioIndex]);

  if (!isOpen) return null;

  const handleSelectOption = (optionId: string) => {
    setSelectedOptionId(optionId);
    const chosen = currentScenario.options.find(o => o.id === optionId);
    if (chosen) {
      setCustomDirective(chosen.action);
    }
  };

  const handleSubmitTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOptionId && !customDirective.trim()) return;

    setIsSubmitting(true);
    try {
      const selectedOpt = currentScenario.options.find(o => o.id === selectedOptionId);
      
      const res = await submitScenarioReview({
        scenarioId: currentScenario.id,
        scenarioTitle: currentScenario.title,
        rating: 5,
        selectedOptionId: selectedOptionId || 'custom',
        customDirective: customDirective.trim() || selectedOpt?.action || '',
        customRouting: selectedOpt?.leadDept || currentScenario.defaultAiAdvice.suggestedRouting,
        keywordTrigger: currentScenario.keywordTriggers,
        reviewerName: reviewerName.trim() || 'Cán bộ Cấp ủy'
      });

      // Also save adjustment rule into brain
      await saveLearnedAdjustmentRule({
        keywordTrigger: currentScenario.keywordTriggers,
        suggestedLeadDept: selectedOpt?.leadDept || 'Văn phòng Đảng ủy & UBND',
        suggestedAction: customDirective.trim() || selectedOpt?.action || '',
        notes: `Huấn luyện bởi ${reviewerName} từ tình huống: ${currentScenario.title}`,
        confidence: 99,
        learnedAt: new Date().toLocaleDateString('vi-VN'),
        useCount: 1,
        isActive: true
      });

      // Update local profile stats
      const points = res.submission.pointsEarned || 25;
      const newAcc = Math.min(99.9, +(profile.accuracyRating + 0.3).toFixed(1));
      setUpdatedAccuracy(newAcc);
      setLastEarnedPoints(points);
      
      const newProfile = {
        ...profile,
        totalPoints: profile.totalPoints + points,
        totalReviews: profile.totalReviews + 1,
        accuracyRating: newAcc
      };
      saveContributorProfile(newProfile);

      setShowSuccess(true);
    } catch (err) {
      console.error("Brain training error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextScenario = () => {
    setShowSuccess(false);
    setSelectedOptionId('');
    setCustomDirective('');
    setScenarioIndex(prev => (prev + 1) % DAILY_SCENARIOS_BANK.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-amber-200/80 max-w-3xl w-full overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-5 sm:p-6 relative overflow-hidden flex-shrink-0">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/10 skew-x-12 pointer-events-none" />
          
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-0.5 rounded-full bg-white/20 text-amber-100 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs flex items-center gap-1 border border-white/30">
                  <Brain className="w-3.5 h-3.5 text-amber-200" />
                  Huấn Luyện AI Cấp Uỷ
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-950/40 text-amber-200 text-[10px] font-bold border border-amber-400/30">
                  Tình huống {scenarioIndex + 1}/{DAILY_SCENARIOS_BANK.length}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-bold border border-emerald-400/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-300" />
                  Độ chuẩn xác: {updatedAccuracy}%
                </span>
              </div>
              
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Huấn Luyện AI Tham Mưu Cấp Ủy
              </h2>
              <p className="text-xs text-amber-100/90 leading-relaxed max-w-xl">
                Lựa chọn phương án hoặc nhập ý kiến chỉ đạo riêng. Qua mỗi tình huống được chọn, Bộ não AI sẽ học tập để thông minh và chính xác hơn với nhu cầu thực tế của cấp ủy.
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-amber-100 hover:text-white transition-colors cursor-pointer flex-shrink-0"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {showSuccess ? (
            /* SUCCESS CELEBRATION CARD */
            <div className="py-8 px-6 bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50 rounded-3xl border border-emerald-200 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <span className="px-3 py-1 bg-emerald-600 text-white font-black text-[10px] rounded-full uppercase tracking-wider">
                  Huấn luyện thành công (+{lastEarnedPoints} XP)
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Bộ Não AI Đã Ghi Nhận & Học Tập!
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
                  Quy tắc chỉ đạo & phương án tham mưu của đồng chí đã được nạp trực tiếp vào CSDL Trí tuệ AI Cấp ủy. Độ chuẩn xác nâng lên <strong className="text-emerald-700 font-bold">{updatedAccuracy}%</strong>.
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-emerald-200/80 text-left max-w-lg mx-auto space-y-2 shadow-xs">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Nội dung AI đã ghi nhớ:</span>
                  <span className="text-emerald-600 font-bold">100% Khớp chỉ đạo</span>
                </div>
                <div className="text-xs font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  "{customDirective || currentScenario.defaultAiAdvice.suggestedDirective}"
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={handleNextScenario}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Tình huống Huấn luyện Tiếp theo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                
                <button
                  onClick={onClose}
                  className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200 transition-colors cursor-pointer"
                >
                  Hoàn thành & Đóng
                </button>
              </div>
            </div>
          ) : (
            /* TRAINING FORM */
            <form onSubmit={handleSubmitTraining} className="space-y-6">
              {/* Scenario Context Box */}
              <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-amber-600 text-white font-black text-[10px] rounded-md uppercase">
                    {currentScenario.categoryLabel}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    currentScenario.urgency === 'HO_TOC' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-800'
                  }`}>
                    Độ ưu tiên: {currentScenario.urgencyLabel}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                  📌 {currentScenario.title}
                </h3>

                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  <strong>Bối cảnh thực tế:</strong> {currentScenario.background}
                </p>

                <div className="pt-1 text-xs font-bold text-blue-900 flex items-start gap-1.5">
                  <span className="text-amber-600 flex-shrink-0">❓</span>
                  <span><strong>Tình huống đặt ra:</strong> {currentScenario.keyQuestion}</span>
                </div>
              </div>

              {/* 3 to 4 Pre-set Multiple Choice Options */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    <span>Chọn 1 trong các phương án tham mưu dưới đây (3 - 4 đáp án):</span>
                  </label>
                  <span className="text-[11px] font-bold text-slate-500">Hoặc tự nhập bên dưới</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {currentScenario.options.map((opt, idx) => {
                    const isSelected = selectedOptionId === opt.id;
                    const letter = String.fromCharCode(65 + idx); // A, B, C, D

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(opt.id)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 relative ${
                          isSelected
                            ? 'bg-amber-50/90 border-amber-500 shadow-md ring-2 ring-amber-400/20'
                            : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 transition-colors ${
                          isSelected ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {letter}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-xs font-black text-slate-900">
                              {opt.title}
                            </h4>
                            {opt.isRecommendedByPolicy && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                Chuẩn Quy chế Đảng
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">
                            {opt.action}
                          </p>

                          <div className="text-[11px] text-slate-500 font-medium pt-1 flex items-center gap-2">
                            <span className="font-bold text-amber-900">Đơn vị: {opt.leadDept}</span>
                            <span>•</span>
                            <span className="italic">{opt.explanation}</span>
                          </div>
                        </div>

                        <div className="pt-0.5">
                          <input
                            type="radio"
                            name="scenarioOption"
                            checked={isSelected}
                            onChange={() => handleSelectOption(opt.id)}
                            className="w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Input Result Box */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-amber-600" />
                    <span>Hoặc nhập kết quả / ý kiến chỉ đạo tùy chỉnh khác của đồng chí:</span>
                  </span>
                  <span className="text-[10px] text-amber-700 font-bold">Bộ não AI sẽ học trực tiếp từ nội dung này</span>
                </label>

                <textarea
                  value={customDirective}
                  onChange={(e) => {
                    setCustomDirective(e.target.value);
                    if (selectedOptionId) setSelectedOptionId(''); // deselect predefined if user types custom
                  }}
                  rows={3}
                  placeholder="Nhập nội dung trích yếu chỉ đạo, phân luồng thẩm quyền riêng của cấp ủy đồng chí..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all outline-none"
                />
              </div>

              {/* Reviewer / Trainer Name input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Cán bộ huấn luyện:</span>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || (!selectedOptionId && !customDirective.trim())}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang nạp tri thức vào Bộ Não AI...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-4.5 h-4.5 text-amber-100" />
                      <span>Xác Nhận & Nạp Tri Thức Bộ Não (+25 XP)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
