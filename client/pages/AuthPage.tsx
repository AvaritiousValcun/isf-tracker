import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Activity, ArrowUpRight, LockKeyhole, Mail, User as UserIcon, Sparkles, ChevronRight, ArrowLeft, ShieldCheck, Zap } from "lucide-react";
import ISFPatch3DHero from "@/components/ISFPatch3DHero";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [viewState, setViewState] = useState<"welcome" | "signin" | "signup">("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (viewState === "signup") {
      if (!fullName.trim()) {
        setError("Please enter your full name");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        setLoading(false);
        return;
      }
      const { error } = await signUp(email.trim(), password, fullName.trim());
      if (error) setError(error);
    } else {
      const { error } = await signIn(email.trim(), password);
      if (error) setError(error);
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAFBFB] text-[#2C4C5C]">
      {/* Background Ambient Glow Circles */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-teal-100/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-amber-100/30 blur-3xl" />

      {/* Navigation Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2C4C5C] to-[#1E343F] text-white shadow-sm">
            <Activity size={20} strokeWidth={2.7} />
          </div>
          <span className="font-display text-[20px] font-bold tracking-[-0.03em] text-[#2C4C5C]">
            ISF<span className="text-[#7A6600]">.</span> Tracker
          </span>
        </div>

        <div className="flex items-center gap-3">
          {viewState === "welcome" ? (
            <>
              <button
                type="button"
                onClick={() => setViewState("signin")}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold text-[#2C4C5C] transition hover:bg-slate-100"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setViewState("signup")}
                className="rounded-xl bg-[#2C4C5C] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#1E343F]"
              >
                Get Started
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setViewState("welcome");
                setError(null);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50"
            >
              <ArrowLeft size={14} /> Back to Overview
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-4 sm:px-8">
        {viewState === "welcome" ? (
          /* Editorial 3D Welcome Showcase (Inspired by Modern 3D Web Landing Pages) */
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-8 lg:pt-8">
            {/* Left Column: Bold Editorial Typography */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/70 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-800 backdrop-blur-xs">
                <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
                Next-Gen Interstitial Biosensing
              </div>

              <h1 className="font-display text-[42px] font-bold leading-[1.08] tracking-[-0.04em] text-[#2C4C5C] sm:text-[54px] lg:text-[62px]">
                Feel Your <br />
                <span className="text-[#0EA5A4]">Hormones.</span> <br />
                In Real Time.
              </h1>

              <p className="max-w-lg text-[15px] leading-relaxed text-[#5A6E78]">
                Continuous micro-needle interstitial fluid (ISF) telemetry tracking 17β-Estradiol, Progesterone, and Cortisol. Clinical endocrine precision, zero venous blood draws.
              </p>

              {/* Call to Actions */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setViewState("signup")}
                  className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#2C4C5C] to-[#1E343F] px-7 py-4 text-[14px] font-bold text-white shadow-[0_12px_28px_rgba(44,76,92,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(44,76,92,0.35)]"
                >
                  <span>Start Tracking</span>
                  <ArrowUpRight size={17} />
                </button>

                <button
                  type="button"
                  onClick={() => setViewState("signin")}
                  className="rounded-2xl border border-slate-300 bg-white/80 px-6 py-4 text-[14px] font-semibold text-[#2C4C5C] shadow-2xs backdrop-blur-xs transition hover:bg-white hover:border-slate-400"
                >
                  Patient Sign In
                </button>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-200/80 text-left">
                <div>
                  <div className="font-display text-[18px] font-bold text-[#2C4C5C]">650 µm</div>
                  <div className="text-[11px] text-slate-500 font-medium">Dermal Penetration</div>
                </div>
                <div>
                  <div className="font-display text-[18px] font-bold text-[#0EA5A4]">3-in-1</div>
                  <div className="text-[11px] text-slate-500 font-medium">Steroid Analytes</div>
                </div>
                <div>
                  <div className="font-display text-[18px] font-bold text-[#7A6600]">24 / 7</div>
                  <div className="text-[11px] text-slate-500 font-medium">Continuous Telemetry</div>
                </div>
              </div>
            </div>

            {/* Right Column: 3D Floating Interactive Biosensor Patch Centerpiece */}
            <div className="relative flex flex-col items-center justify-center">
              <div className="relative w-full max-w-[460px] rounded-[36px] border border-white/80 bg-gradient-to-b from-white/90 to-slate-100/60 p-6 shadow-[0_25px_60px_-15px_rgba(44,76,92,0.12)] backdrop-blur-md">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Interactive 3D Wearable</span>
                  <span className="flex items-center gap-1 text-teal-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> Live Parallax
                  </span>
                </div>

                {/* 3D Model Rendering with Mouse Parallax & Ambient Levitation */}
                <ISFPatch3DHero variant="hero" />

                <div className="mt-2 text-center">
                  <p className="text-[12px] font-medium text-slate-500">
                    Move your cursor over the patch to tilt in 3D space
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Sign In & Sign Up Interactive View */
          <div className="mx-auto grid max-w-4xl grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:pt-4">
            {/* Left Side: 3D Miniature Showcase & Value Prop */}
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-3 py-1 text-[11px] font-semibold text-teal-800">
                <Sparkles size={13} className="text-[#7A6600]" />
                {viewState === "signin" ? "Patient Access" : "Create Patient Account"}
              </div>

              <h2 className="font-display text-[32px] font-bold tracking-[-0.03em] text-[#2C4C5C] sm:text-[38px]">
                {viewState === "signin" ? "Welcome back." : "Your health, decoded."}
              </h2>

              <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#5A6E78]">
                {viewState === "signin"
                  ? "Sign in to synchronize with your wearable ISF sensor patch and review your daily endocrine trends."
                  : "Begin your personalized hormone tracking journey with continuous micro-needle monitoring."}
              </p>

              {/* 3D Patch Mini Preview */}
              <div className="mt-4 w-full max-w-[320px]">
                <ISFPatch3DHero variant="compact" />
              </div>
            </div>

            {/* Right Side: Authentication Card */}
            <div className="rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_20px_50px_rgba(44,76,92,0.08)] sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                {viewState === "signup" && (
                  <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-[#2C4C5C]">Full name</label>
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition focus-within:border-[#2C4C5C] focus-within:ring-2 focus-within:ring-[#2C4C5C]/10">
                      <UserIcon size={16} className="text-slate-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="min-w-0 flex-1 bg-transparent text-[13px] text-[#2C4C5C] outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#2C4C5C]">Email</label>
                  <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition focus-within:border-[#2C4C5C] focus-within:ring-2 focus-within:ring-[#2C4C5C]/10">
                    <Mail size={16} className="text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      required
                      className="min-w-0 flex-1 bg-transparent text-[13px] text-[#2C4C5C] outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#2C4C5C]">Password</label>
                  <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition focus-within:border-[#2C4C5C] focus-within:ring-2 focus-within:ring-[#2C4C5C]/10">
                    <LockKeyhole size={16} className="text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="min-w-0 flex-1 bg-transparent text-[13px] text-[#2C4C5C] outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2C4C5C] to-[#1E343F] py-3.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(44,76,92,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(44,76,92,0.28)] disabled:opacity-60"
                >
                  {loading ? "Please wait..." : viewState === "signin" ? "Sign in to Dashboard" : "Create Account"}
                  {!loading && <ArrowUpRight size={15} />}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setViewState(viewState === "signin" ? "signup" : "signin");
                    setError(null);
                  }}
                  className="text-[12px] font-semibold text-[#5A6E78] transition hover:text-[#2C4C5C]"
                >
                  {viewState === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>

              <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                <LockKeyhole size={11} /> 256-bit encrypted health telemetry
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
