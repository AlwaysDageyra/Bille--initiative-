import { motion } from "framer-motion";

export function Card({ children, className = "", ...props }) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary:
      "bg-gradient-to-b from-gold-400 to-gold-500 text-ink-950 shadow-md shadow-gold-500/25 hover:shadow-lg hover:shadow-gold-500/30 hover:-translate-y-0.5 active:translate-y-0",
    secondary:
      "bg-white text-ink-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100",
    danger:
      "bg-red-600 text-white shadow-md shadow-red-600/25 hover:bg-red-500 hover:-translate-y-0.5 active:translate-y-0",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
          <Icon size={20} />
        </div>
      )}
      <p className="font-semibold text-slate-600">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-slate-400">{subtitle}</p>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, accent = "gold", delay = 0 }) {
  const accents = {
    gold: "from-gold-400/25 to-gold-500/5 text-gold-600",
    blue: "from-blue-400/25 to-blue-500/5 text-blue-600",
    purple: "from-purple-400/25 to-purple-500/5 text-purple-600",
    emerald: "from-emerald-400/25 to-emerald-500/5 text-emerald-600",
    red: "from-red-400/25 to-red-500/5 text-red-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
    >
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${accents[accent]}`}>
        <Icon size={18} strokeWidth={2.25} />
      </div>
      <p className="text-2xl font-extrabold tracking-tight text-ink-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </motion.div>
  );
}

export function PageTransition({ children, transitionKey }) {
  return (
    <motion.div
      key={transitionKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Spinner({ className = "" }) {
  return (
    <div className={`grid min-h-[40vh] place-items-center ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-gold-500" />
    </div>
  );
}
