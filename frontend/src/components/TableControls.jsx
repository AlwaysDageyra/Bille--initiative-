import { Search, ChevronLeft, ChevronRight, AlertOctagon, Gauge } from "lucide-react";

export function SearchInput({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
      />
    </div>
  );
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Pagination({ page, pageCount, onChange, total, pageSize }) {
  if (pageCount <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
      <span>{start}–{end} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-xs font-medium text-slate-600">Page {page} of {pageCount}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function OverdueTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-200">
      <AlertOctagon size={11} /> Overdue
    </span>
  );
}

export const URGENCY_STYLES = {
  High: { border: "border-l-red-500", dot: "bg-red-500", chip: "bg-red-50 text-red-700 ring-red-200" },
  Medium: { border: "border-l-amber-500", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 ring-amber-200" },
  Low: { border: "border-l-emerald-500", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};
export const DEFAULT_URGENCY_STYLE = { border: "border-l-slate-300", dot: "bg-slate-300", chip: "bg-slate-100 text-slate-500 ring-slate-200" };

export function UrgencyChip({ urgency }) {
  const style = URGENCY_STYLES[urgency] || DEFAULT_URGENCY_STYLE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {urgency || "Unrated"}
    </span>
  );
}

export function Avatar({ name, size = "md" }) {
  const initials = (name || "?").trim().slice(0, 2).toUpperCase();
  const sizes = { md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base" };
  return (
    <span className={`grid flex-none place-items-center rounded-full bg-ink-900 font-bold text-white ${sizes[size]}`}>
      {initials}
    </span>
  );
}

export const CONFIDENCE_STYLES = {
  High: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  Low: "bg-red-50 text-red-700 ring-red-200",
};

export function ConfidenceChip({ confidence }) {
  if (!confidence) return <span className="text-sm text-slate-400">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${CONFIDENCE_STYLES[confidence] || "bg-slate-100 text-slate-500 ring-slate-200"}`}>
      <Gauge size={11} /> {confidence}
    </span>
  );
}

export function usePagedResult(items, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return { pageItems, pageCount, safePage };
}
