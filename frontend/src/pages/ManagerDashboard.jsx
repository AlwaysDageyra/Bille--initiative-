import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Send, RefreshCw, CheckCircle2, ArrowRight } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import StatusBadge, { STATUS_OPTIONS } from "../components/StatusBadge";
import { Card, EmptyState, StatCard } from "../components/ui";
import {
  SearchInput, Select, Pagination, OverdueTag, usePagedResult,
  Avatar, URGENCY_STYLES, DEFAULT_URGENCY_STYLE,
} from "../components/TableControls";
import { sortByPriority, isOverdue } from "../utils/priority";

const PAGE_SIZE = 8;
const QUEUE_STATUS_OPTIONS = STATUS_OPTIONS.filter((o) => ["routed", "in_progress", "closed"].includes(o.value));

function QueueItem({ item, index }) {
  const urgencyStyle = URGENCY_STYLES[item.urgency] || DEFAULT_URGENCY_STYLE;
  const overdue = isOverdue(item.deadline, item.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
      className={`flex flex-col gap-4 border-l-4 bg-white p-5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between ${urgencyStyle.border}`}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <Avatar name={item.sender} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-ink-900">{item.subject}</p>
            {overdue && <OverdueTag />}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{item.sender || "Unknown sender"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap sm:gap-4">
        <div className="min-w-[6.5rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Deadline</p>
          <p className="text-sm text-slate-600">{item.deadline || "—"}</p>
        </div>

        <StatusBadge status={item.status} />

        <Link
          to={`/correspondence/${item.id}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 shadow-sm transition hover:shadow-md sm:ml-0"
        >
          Open <ArrowRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.listCorrespondence().then(setItems);
  }, []);

  const sorted = useMemo(() => sortByPriority(items), [items]);

  const stats = {
    total: items.length,
    routed: items.filter((c) => c.status === "routed").length,
    inProgress: items.filter((c) => c.status === "in_progress").length,
    closed: items.filter((c) => c.status === "closed").length,
  };

  const filtered = useMemo(() => {
    return sorted.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${c.subject || ""} ${c.sender || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, statusFilter, search]);

  const { pageItems, pageCount, safePage } = usePagedResult(filtered, page, PAGE_SIZE);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{user.department_name} Queue</h1>
        <p className="mt-1 text-sm text-slate-500">Correspondence routed to your department, sorted by priority.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Building2} label="In queue" value={stats.total} accent="gold" delay={0} />
        <StatCard icon={Send} label="Newly routed" value={stats.routed} accent="blue" delay={0.05} />
        <StatCard icon={RefreshCw} label="In progress" value={stats.inProgress} accent="purple" delay={0.1} />
        <StatCard icon={CheckCircle2} label="Closed" value={stats.closed} accent="emerald" delay={0.15} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search subject, sender..." />
        <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="All statuses" options={QUEUE_STATUS_OPTIONS} />
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          {pageItems.map((item, i) => (
            <QueueItem key={item.id} item={item} index={i} />
          ))}
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={Building2}
            title={items.length === 0 ? "Nothing routed to your department yet" : "No matches"}
            subtitle={items.length > 0 ? "Try a different search or filter." : undefined}
          />
        )}
        <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
