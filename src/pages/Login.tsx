import { useState } from "react";
import { loginWithGoogle } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import { Building2, Sparkles, CheckCircle2, AlertTriangle, Copy, ExternalLink, UserCheck, ShieldCheck, Loader2 } from "lucide-react";

export default function Login() {
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentHost = typeof window !== "undefined" ? window.location.hostname : "";

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setUnauthorizedDomain(null);
    try {
      const { user } = await loginWithGoogle();
      if (user) {
        setUser({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "Cán bộ Văn phòng",
          role: "OFFICE"
        });
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      const code = err?.code || "";
      const message = err?.message || String(err);

      if (code === "auth/unauthorized-domain" || message.includes("unauthorized-domain")) {
        setUnauthorizedDomain(currentHost);
        setErrorMsg(`Tên miền "${currentHost}" chưa được thêm vào Danh sách Tên miền được ủy quyền (Authorized Domains) trong Firebase Console của dự án "trolycvp".`);
      } else if (code === "auth/popup-closed-by-user") {
        setErrorMsg("Cửa sổ đăng nhập Google đã đóng trước khi hoàn tất.");
      } else {
        setErrorMsg(message || "Đăng nhập Google không thành công. Vui lòng thử lại.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (roleName: string, email: string) => {
    setUser({
      uid: "officer-demo-user",
      email: email,
      displayName: roleName,
      role: "OFFICE"
    });
  };

  const copyDomain = () => {
    if (unauthorizedDomain) {
      navigator.clipboard.writeText(unauthorizedDomain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100/70 p-4 font-sans text-slate-800">
      <div className="w-full max-w-md space-y-6 rounded-3xl bg-white p-8 sm:p-10 shadow-xl border border-slate-200">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-md mb-4">
            <Building2 className="w-7 h-7" />
          </div>
          
          <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-100 text-[10px] font-bold rounded-full uppercase tracking-wider mb-2">
            Hệ thống Cấp ủy & Chính quyền
          </span>

          <h1 className="text-xl font-black tracking-tight text-slate-900 leading-tight">
            TRỢ LÝ THAM MƯU<br />& XỬ LÝ VĂN BẢN
          </h1>
          
          <p className="mt-2 text-xs text-slate-500 max-w-xs leading-relaxed">
            Thẩm định thẩm quyền, phân luồng văn bản và lập phiếu trình tự động bằng Trí tuệ nhân tạo Gemini.
          </p>
        </div>

        {/* Unauthorized domain notification box */}
        {unauthorizedDomain && (
          <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-2.5 text-xs text-amber-900 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Cần ủy quyền tên miền trên Firebase</span>
            </div>
            
            <p className="text-[11px] leading-relaxed text-amber-800">
              Dự án <strong>trolycvp</strong> đang bảo mật xác thực. Bạn chỉ cần thêm tên miền sau vào <strong>Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</strong>:
            </p>

            <div className="flex items-center gap-1.5 p-2 bg-white rounded-xl border border-amber-200 text-[11px] font-mono text-slate-800 break-all">
              <span className="flex-1 select-all">{unauthorizedDomain}</span>
              <button 
                onClick={copyDomain}
                className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors flex-shrink-0"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? "Đã chép" : "Sao chép"}</span>
              </button>
            </div>

            <a
              href="https://console.firebase.google.com/project/trolycvp/authentication/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline pt-0.5"
            >
              <span>Mở cài đặt Authorized Domains trên Firebase Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* General Error Banner */}
        {errorMsg && !unauthorizedDomain && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Tính năng cốt lõi</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Phân luồng: Báo cáo BTV / Thường trực / UBND</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Bóc tách nhiệm vụ & đơn vị chủ trì, phối hợp</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>Xuất Phiếu Trình & Tự động đồng bộ Google Drive</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-3 rounded-xl bg-blue-600 py-3.5 px-4 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/25 hover:shadow-lg active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isLoading ? "Đang kết nối Google..." : "Đăng nhập với Google Workspace"}</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Hoặc</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleQuickLogin("Quản trị viên Hệ thống (Admin)", "nguyenhuy.thudaumot@gmail.com")}
              className="w-full flex justify-center items-center gap-2 rounded-xl bg-amber-50 hover:bg-amber-100/90 hover:text-amber-900 border border-amber-300/80 py-2.5 px-4 text-xs font-extrabold text-amber-900 transition-all active:scale-[0.99] shadow-2xs"
            >
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Đăng nhập Quản trị viên (nguyenhuy.thudaumot@gmail.com)</span>
            </button>

            <button
              onClick={() => handleQuickLogin("Chuyên viên Tổng hợp", "chuyenvien@vanphong.gov.vn")}
              className="w-full flex justify-center items-center gap-2 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 py-2.5 px-4 text-xs font-bold text-slate-700 transition-all active:scale-[0.99]"
            >
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>Vào bàn làm việc với tư cách Cán bộ Văn phòng</span>
            </button>
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-400">
          Hệ thống bảo mật dữ liệu theo quy định hành chính điện tử
        </div>
      </div>
    </div>
  );
}
