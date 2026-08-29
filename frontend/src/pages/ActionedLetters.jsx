import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, IdCard, History } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import { Card, EmptyState, StatCard } from "../components/ui";
import {
  SearchInput, Select, Pagination, OverdueTag, usePagedResult,
  Avatar, URGENCY_STYLES, DEFAULT_URGENCY_STYLE,
} from "../components/TableControls";
import { sortByPriority, isOverdue, slaStatus } from "../utils/priority";

const PAGE_SIZE = 8;
const STATUS_OPTIONS = [
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
];

function ActionedItem({ item, index, slaDays }) {
  const urgencyStyle = URGENCY_STYLES[item.urgency] || DEFAULT_URGENCY_STYLE;
  const overdue = isOverdue(item.deadline, item.status);
  const sla = item.status !== "closed" ? slaStatus(item.routed_at, slaDays) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
      className={`flex flex-col gap-4 border-l-4 bg-white dark:bg-ink-900 p-5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between ${urgencyStyle.border}`}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <Avatar name={item.sender} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-ink-900 dark:text-white">{item.subject || "(no subject)"}</p>
            {overdue && <OverdueTag />}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500 dark:text-white/50">
            {item.sender || "Unknown sender"}
            {item.submitter_username && (
              <span className="ml-2 inline-flex items-center gap-1 text-slate-400 dark:text-white/35">
                <IdCard size={12} /> Submitted by {item.submitter_username}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap sm:gap-4">
        <div className="min-w-[6.5rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">Deadline</p>
          <p className="text-sm text-slate-600 dark:text-white/65">{item.deadline || "—"}</p>
        </div>

        {sla && (
          <div className="min-w-[7rem]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">SLA</p>
            <p className={`inline-flex items-center gap-1 text-sm font-medium ${sla.overdue ? "text-red-600" : "text-slate-600 dark:text-white/65"}`}>
              {sla.overdue && <AlertTriangle size={12} />}
              {sla.overdue ? `Overdue by ${Math.abs(sla.daysLeft)}d` : `${sla.daysLeft}d left`}
            </p>
          </div>
        )}

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

export default function ActionedLetters() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.listCorrespondence().then(setItems);
    api.listDepartments().then(setDepartments);
  }, []);

  const ownDepartment = departments.find((d) => d.id === user.department_id);
  const slaDays = ownDepartment?.sla_days || null;

  // "New Arrivals" owns the routed-but-not-started letters; this page is
  // specifically for what's already been picked up — never shows "routed".
  const actioned = useMemo(
    () => sortByPriority(items.filter((c) => c.status === "in_progress" || c.status === "closed")),
    [items]
  );

  const stats = {
    inProgress: actioned.filter((c) => c.status === "in_progress").length,
    closed: actioned.filter((c) => c.status === "closed").length,
    overdue: actioned.filter((c) => isOverdue(c.deadline, c.status)).length,
  };

  const filtered = useMemo(() => {
    return actioned.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${c.subject || ""} ${c.sender || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [actioned, statusFilter, search]);

  const { pageItems, pageCount, safePage } = usePagedResult(filtered, page, PAGE_SIZE);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">In Progress &amp; Closed</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">Letters your department has already picked up — being worked on or resolved.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:w-3/4 md:grid-cols-3">
        <StatCard icon={RefreshCw} label="In progress" value={stats.inProgress} accent="purple" delay={0} />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} accent="red" delay={0.05} />
        <StatCard icon={CheckCircle2} label="Closed" value={stats.closed} accent="emerald" delay={0.1} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search subject, sender..." />
        <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="In Progress or Closed" options={STATUS_OPTIONS} />
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {pageItems.map((item, i) => (
            <ActionedItem key={item.id} item={item} index={i} slaDays={slaDays} />
          ))}
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={History}
            title={actioned.length === 0 ? "Nothing actioned yet" : "No matches"}
            subtitle={actioned.length > 0 ? "Try a different search or filter." : "Letters you've marked In Progress or Closed will show up here."}
          />
        )}
        <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
