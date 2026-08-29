import { FileText, AlertCircle, Clock, Send, RefreshCw, CheckCircle2 } from "lucide-react";

const STATUS_STYLES = {
  submitted: { label: "Submitted", icon: FileText, classes: "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/65 ring-slate-200 dark:ring-white/10" },
  ai_analyzed: { label: "AI Failed", icon: AlertCircle, classes: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 ring-red-200 dark:ring-red-800/60" },
  pending_coordinator_review: { label: "Pending Review", icon: Clock, classes: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800/60" },
  routed: { label: "Forwarded", icon: Send, classes: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 ring-blue-200 dark:ring-blue-800/60" },
  in_progress: { label: "In Progress", icon: RefreshCw, classes: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 ring-purple-200 dark:ring-purple-800/60" },
  closed: { label: "Closed", icon: CheckCircle2, classes: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/60" },
};

export const STATUS_OPTIONS = Object.entries(STATUS_STYLES).map(([value, { label }]) => ({ value, label }));

// Submitter-facing screens shouldn't need to know the extraction step is
// AI-driven — "Needs Attention" reads as a normal processing hiccup instead.
const SIMPLIFIED_LABELS = { ai_analyzed: "Needs Attention" };

export default function StatusBadge({ status, simplified = false }) {
  const style = STATUS_STYLES[status] || { label: status, icon: FileText, classes: "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/65 ring-slate-200 dark:ring-white/10" };
  const Icon = style.icon;
  const label = simplified ? SIMPLIFIED_LABELS[status] || style.label : style.label;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${style.classes}`}>
      <Icon size={12} strokeWidth={2.5} />
      {label}
    </span>
  );
}
