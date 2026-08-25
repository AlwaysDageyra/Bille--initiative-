import { FileText, AlertCircle, Clock, Send, RefreshCw, CheckCircle2 } from "lucide-react";

const STATUS_STYLES = {
  submitted: { label: "Submitted", icon: FileText, classes: "bg-slate-100 text-slate-600 ring-slate-200" },
  ai_analyzed: { label: "AI Failed", icon: AlertCircle, classes: "bg-red-50 text-red-600 ring-red-200" },
  pending_coordinator_review: { label: "Pending Review", icon: Clock, classes: "bg-amber-50 text-amber-700 ring-amber-200" },
  routed: { label: "Routed", icon: Send, classes: "bg-blue-50 text-blue-600 ring-blue-200" },
  in_progress: { label: "In Progress", icon: RefreshCw, classes: "bg-purple-50 text-purple-600 ring-purple-200" },
  closed: { label: "Closed", icon: CheckCircle2, classes: "bg-emerald-50 text-emerald-600 ring-emerald-200" },
};

export const STATUS_OPTIONS = Object.entries(STATUS_STYLES).map(([value, { label }]) => ({ value, label }));

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { label: status, icon: FileText, classes: "bg-slate-100 text-slate-600 ring-slate-200" };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${style.classes}`}>
      <Icon size={12} strokeWidth={2.5} />
      {style.label}
    </span>
  );
}
