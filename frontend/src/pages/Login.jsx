import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ScanSearch, Route, History, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui";

const DEMO_ACCOUNTS = [
  { username: "ngo1", label: "Submitter" },
  { username: "coordinator1", label: "Coordinator" },
  { username: "hr_manager", label: "Dept Manager · Administration & HR" },
  { username: "finance_manager", label: "Dept Manager · Finance" },
  { username: "procurement_manager", label: "Dept Manager · Procurement" },
];

const FEATURES = [
  { icon: ScanSearch, title: "AI-Powered Extraction", text: "Ollama reads every letter and pulls subject, sender, deadline and required action automatically." },
  { icon: Route, title: "Smart Department Routing", text: "The AI recommends the right department; your coordinator confirms before anything is sent." },
  { icon: History, title: "Full Action History", text: "Every review, route and status change is logged so nothing gets lost in the process." },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f4f6fb]">
      {/* Hero panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-ink-800 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative z-10 px-14 pt-14">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 shadow-lg shadow-gold-500/30">
              <Sparkles size={20} strokeWidth={2.5} />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">GovFlow AI</span>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mt-16 max-w-md text-4xl font-extrabold leading-tight tracking-tight text-white"
          >
            Correspondence, handled <span className="text-gold-400">faster</span> and with confidence.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 max-w-sm text-slate-400"
          >
            From intake to routing to action — GovFlow AI keeps every letter, memo and notice moving through the right hands.
          </motion.p>
        </div>

        <div className="relative z-10 space-y-4 px-14 pb-14">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-gold-500/15 text-gold-400">
                <f.icon size={17} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{f.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{f.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Login form */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <motion.form
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          onSubmit={handleSubmit}
          className="w-full max-w-sm"
        >
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950">
                <Sparkles size={18} strokeWidth={2.5} />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-ink-900">GovFlow AI</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-ink-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue to your dashboard.</p>

          <label className="mt-7 block text-sm font-medium text-ink-900">
            Username
            <input
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-ink-900">
            Password
            <input
              type="password"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

          <Button type="submit" disabled={submitting} className="mt-6 w-full">
            {submitting ? "Logging in..." : "Log in"} {!submitting && <ArrowRight size={16} />}
          </Button>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500">Demo accounts &middot; click to fill</p>
            <ul className="mt-2 space-y-0.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <li key={acc.username}>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername(acc.username);
                      setPassword("password123");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs text-slate-500 transition hover:bg-white hover:text-ink-900"
                  >
                    <code className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-ink-900">{acc.username}</code>
                    <span className="text-right">{acc.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
