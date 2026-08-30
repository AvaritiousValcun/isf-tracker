import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Activity, ArrowUpRight, LockKeyhole, Mail, User as UserIcon } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-[#B8BFC1] px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center">
          <div className="brand-mark mb-4 h-12 w-12 rounded-2xl">
            <Activity size={22} strokeWidth={2.7} />
          </div>
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.04em] text-[#2C4C5C]">
            ISF<span className="text-[#7A6600]">.</span> Tracker
          </h1>
          <p className="mt-2 text-[13px] text-[#5A6E78]">
            {mode === "signin" ? "Welcome back. Sign in to your account." : "Create your account to get started."}
          </p>
        </div>

        <div className="rounded-[24px] border-2 border-[#2C4C5C]/15 bg-white p-6 shadow-[0_14px_45px_rgba(44,76,92,0.08)] sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold text-[#2C4C5C]">Full name</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <UserIcon size={16} className="text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Amani Mwangi"
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-[#2C4C5C] outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#2C4C5C]">Email</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
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
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C4C5C] py-3.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(44,76,92,0.2)] transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
              {!loading && <ArrowUpRight size={15} />}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="text-[12px] font-semibold text-[#5A6E78] transition hover:text-[#2C4C5C]"
            >
              {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-[#5A6E78]">
          <LockKeyhole size={11} /> Your health data is private and encrypted
        </p>
      </div>
    </div>
  );
}
