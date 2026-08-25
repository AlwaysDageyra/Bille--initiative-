import { Search, ChevronLeft, ChevronRight, AlertOctagon } from "lucide-react";

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

export function usePagedResult(items, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return { pageItems, pageCount, safePage };
}
