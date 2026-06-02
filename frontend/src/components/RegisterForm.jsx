import { useState } from "react";

export default function RegisterForm({ onRegister, onSwitch, error }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [email, setEmail] = useState("");

  async function handleSubmit() {
    if (password !== confirm) return setLocalError("Passwords do not match");
    if (password.length < 6) return setLocalError("Password must be at least 6 characters");
    setLocalError("");
    setLoading(true);
    await onRegister(username, email, password);
    setLoading(false);
  }

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-[#020818] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#0d1f4a_0%,_#020818_70%)]" />
      <div className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(0,200,255,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0,200,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "40px 40px"
        }}
      />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-blue-600/10 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400/60 text-xs tracking-[0.3em] uppercase font-mono">VisionCore OS</span>
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight" style={{ fontFamily: "'Orbitron', monospace" }}>
            REGISTER
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-mono tracking-widest">CREATE OPERATOR PROFILE</p>
        </div>

        <div className="relative bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-8 shadow-[0_0_40px_rgba(0,200,255,0.05)]">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

          {displayError && (
            <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <p className="text-red-400 text-sm font-mono">{displayError}</p>
            </div>
          )}
        <div className="space-y-1.5">
            <label className="text-cyan-400/70 text-xs font-mono tracking-[0.2em] uppercase">Email</label>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/40 font-mono text-sm">›</div>
                <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="operator@domain.com"
                className="w-full bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 rounded-lg pl-8 pr-4 py-3 text-white placeholder-slate-600 font-mono text-sm outline-none transition-all duration-200"
                />
            </div>
        </div>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-cyan-400/70 text-xs font-mono tracking-[0.2em] uppercase">Username</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/40 font-mono text-sm">›</div>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="choose username"
                  className="w-full bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 rounded-lg pl-8 pr-4 py-3 text-white placeholder-slate-600 font-mono text-sm outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-cyan-400/70 text-xs font-mono tracking-[0.2em] uppercase">Password</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/40 font-mono text-sm">›</div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/50 border border-slate-700/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 rounded-lg pl-8 pr-4 py-3 text-white placeholder-slate-600 font-mono text-sm outline-none transition-all duration-200"
                />
              </div>
              {password && (
                <div className="flex gap-1 mt-1.5">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
                      password.length >= i * 3
                        ? i <= 1 ? "bg-red-500" : i <= 2 ? "bg-yellow-500" : i <= 3 ? "bg-blue-400" : "bg-cyan-400"
                        : "bg-slate-700"
                    }`} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-cyan-400/70 text-xs font-mono tracking-[0.2em] uppercase">Confirm Password</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/40 font-mono text-sm">›</div>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="••••••••"
                  className={`w-full bg-slate-800/50 border rounded-lg pl-8 pr-4 py-3 text-white placeholder-slate-600 font-mono text-sm outline-none transition-all duration-200 ${
                    confirm && confirm !== password
                      ? "border-red-500/50 focus:border-red-500/70"
                      : confirm && confirm === password
                      ? "border-cyan-500/50"
                      : "border-slate-700/50 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                  }`}
                />
                {confirm && (
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono ${confirm === password ? "text-cyan-400" : "text-red-400"}`}>
                    {confirm === password ? "✓" : "✗"}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="relative w-full mt-2 py-3 rounded-lg font-mono text-sm tracking-[0.2em] uppercase font-bold overflow-hidden group transition-all duration-200 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0369a1, #0891b2)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-cyan-400/10 to-cyan-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <div className="absolute inset-0 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" />
              <span className="relative text-white">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Profile...
                  </span>
                ) : "Initialize Profile"}
              </span>
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-center text-slate-600 text-xs font-mono">
              Already registered?{" "}
              <button onClick={onSwitch} className="text-cyan-400 hover:text-cyan-300 transition-colors tracking-wider">
                SIGN IN
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-slate-700 text-xs font-mono mt-6 tracking-widest">
          VISIONCORE · ENCRYPTED CHANNEL · v1.0.0
        </p>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');`}</style>
    </div>
  );
}