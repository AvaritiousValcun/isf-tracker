import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Activity, ArrowUpRight, LockKeyhole, Mail, User as UserIcon, Sparkles } from "lucide-react";
import ISFBiosensor3D from "@/components/ISFBiosensor3D";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#CBD5E1] via-[#B8BFC1] to-[#94A3B8] px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-[960px]">
        {/* Main Dual-Column Container */}
        <div className="grid grid-cols-1 items-center gap-6 rounded-[32px] border-2 border-white/60 bg-white/70 p-4 shadow-[0_25px_60px_-15px_rgba(44,76,92,0.18)] backdrop-blur-md sm:p-6 lg:grid-cols-2 lg:gap-8 lg:p-8">
          
          {/* Left Column: 3D Scientific Biosensor Presentation */}
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="brand-mark h-10 w-10 rounded-xl">
                <Activity size={20} strokeWidth={2.7} />
              </div>
              <div>
                <h1 className="font-display text-[22px] font-bold tracking-[-0.04em] text-[#2C4C5C]">
                  ISF<span className="text-[#7A6600]">.</span> Tracker
                </h1>
                <p className="text-[11px] font-medium text-slate-500">
                  Continuous Endocrine Biosensing
                </p>
              </div>
            </div>

            <p className="mb-4 text-[13px] leading-relaxed text-[#5A6E78]">
              Continuous micro-needle biosensing of interstitial fluid hormones for non-invasive reproductive & endocrine health tracking.
            </p>

            {/* 3D Canvas Visualizer */}
            <ISFBiosensor3D />
          </div>

          {/* Right Column: Sign In / Sign Up Form */}
          <div className="flex flex-col justify-center rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2C4C5C]/[0.08] px-3 py-1 text-[11px] font-semibold text-[#2C4C5C]">
                <Sparkles size={12} className="text-[#7A6600]" />
                {mode === "signin" ? "Secure Patient Portal" : "New Patient Registration"}
              </span>
              <h2 className="mt-2.5 font-display text-[24px] font-bold tracking-[-0.03em] text-[#2C4C5C]">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-1 text-[13px] text-slate-500">
                {mode === "signin"
                  ? "Enter your credentials to access your hormone telemetry."
                  : "Register to begin continuous interstitial monitoring."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#2C4C5C]">Full name</label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 transition focus-within:border-[#2C4C5C] focus-within:ring-2 focus-within:ring-[#2C4C5C]/10">
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
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 transition focus-within:border-[#2C4C5C] focus-within:ring-2 focus-within:ring-[#2C4C5C]/10">
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
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 transition focus-within:border-[#2C4C5C] focus-within:ring-2 focus-within:ring-[#2C4C5C]/10">
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2C4C5C] to-[#1E343F] py-3.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(44,76,92,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(44,76,92,0.3)] disabled:opacity-60"
              >
                {loading ? "Please wait..." : mode === "signin" ? "Sign in to Dashboard" : "Create Account"}
                {!loading && <ArrowUpRight size={15} />}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                }}
                className="text-[12px] font-semibold text-[#5A6E78] transition hover:text-[#2C4C5C]"
              >
                {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <LockKeyhole size={11} /> 256-bit encrypted health telemetry
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
