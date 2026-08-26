import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardCheck, Inbox, Send, CheckCircle2, ArrowRight, Download } from "lucide-react";
import { api } from "../api";
import StatusBadge, { STATUS_OPTIONS } from "../components/StatusBadge";
import { Card, EmptyState, StatCard, Button } from "../components/ui";
import { SearchInput, Select, Pagination, usePagedResult, Avatar } from "../components/TableControls";
import { downloadCSV } from "../utils/csv";

const PAGE_SIZE = 8;

function CorrespondenceRow({ item, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
      className="flex flex-col gap-4 bg-white p-5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <Avatar name={item.sender} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-900">{item.subject || <em className="font-normal text-slate-400">(no subject)</em>}</p>
          <p className="mt-1 truncate text-sm text-slate-500">{item.sender || "Unknown sender"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap sm:gap-4">
        <div className="min-w-[7rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Final Dept</p>
          <p className="text-sm font-medium text-ink-900">{item.final_department_name || "—"}</p>
        </div>

        <StatusBadge status={item.status} />

        <Link
          to={`/correspondence/${item.id}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 shadow-sm transition hover:shadow-md sm:ml-0"
        >
          View <ArrowRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}

export default function CoordinatorDashboard() {
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.listCorrespondence().then(setItems);
    api.listDepartments().then(setDepartments);
  }, []);

  const pending = items.filter((c) => c.status === "pending_coordinator_review");
  const others = items.filter((c) => c.status !== "pending_coordinator_review");

  const stats = {
    total: items.length,
    pending: pending.length,
    routed: items.filter((c) => ["routed", "in_progress"].includes(c.status)).length,
    closed: items.filter((c) => c.status === "closed").length,
  };

  const filtered = useMemo(() => {
    return others.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (deptFilter && String(c.final_department_id) !== deptFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${c.subject || ""} ${c.sender || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [others, statusFilter, deptFilter, search]);

  const { pageItems, pageCount, safePage } = usePagedResult(filtered, page, PAGE_SIZE);

  const handleExport = () => {
    downloadCSV(
      `govflow-correspondence-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((c) => ({
        id: c.id,
        subject: c.subject,
        sender: c.sender,
        final_department: c.final_department_name,
        status: c.status,
        urgency: c.urgency,
        deadline: c.deadline,
        submitted_at: c.created_at,
      }))
    );
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Coordinator Overview</h1>
        <p className="mt-1 text-sm text-slate-500">Confirm the AI's department recommendation before routing correspondence.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Inbox} label="Total received" value={stats.total} accent="gold" delay={0} />
        <StatCard icon={ClipboardCheck} label="Pending your review" value={stats.pending} accent="blue" delay={0.05} />
        <StatCard icon={Send} label="Routed" value={stats.routed} accent="purple" delay={0.1} />
        <StatCard icon={CheckCircle2} label="Closed" value={stats.closed} accent="emerald" delay={0.15} />
      </div>

      {pending.length > 0 && (
        <Link
          to="/queue"
          className="mb-8 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 transition hover:bg-amber-100"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold text-amber-800">
            <ClipboardCheck size={17} />
            {pending.length} letter{pending.length === 1 ? "" : "s"} waiting in your Approval Queue
          </span>
          <ArrowRight size={16} className="text-amber-700" />
        </Link>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-ink-900">All Correspondence</h2>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search subject, sender..." />
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="All statuses" options={STATUS_OPTIONS} />
          <Select
            value={deptFilter}
            onChange={(v) => { setDeptFilter(v); setPage(1); }}
            placeholder="All departments"
            options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
          />
          <Button variant="secondary" onClick={handleExport} disabled={filtered.length === 0}>
            <Download size={15} /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          {pageItems.map((item, i) => (
            <CorrespondenceRow key={item.id} item={item} index={i} />
          ))}
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={Inbox}
            title={others.length === 0 ? "No correspondence yet" : "No matches"}
            subtitle={others.length > 0 ? "Try a different search or filter." : undefined}
          />
        )}
        <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
