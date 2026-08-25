import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardCheck, Inbox, Send, CheckCircle2, ArrowRight, Download } from "lucide-react";
import { api } from "../api";
import StatusBadge, { STATUS_OPTIONS } from "../components/StatusBadge";
import { Card, EmptyState, StatCard, Button } from "../components/ui";
import { SearchInput, Select, Pagination, usePagedResult } from "../components/TableControls";
import { downloadCSV } from "../utils/csv";

const PAGE_SIZE = 8;

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Final Dept</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
                  className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/80"
                >
                  <td className="px-5 py-3.5 font-medium text-ink-900">{c.subject || <em className="font-normal text-slate-400">(no subject)</em>}</td>
                  <td className="px-5 py-3.5 text-slate-600">{c.final_department_name || "—"}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3.5">
                    <Link to={`/correspondence/${c.id}`} className="font-semibold text-gold-600 hover:text-gold-500">View</Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon={Inbox}
              title={others.length === 0 ? "No correspondence yet" : "No matches"}
              subtitle={others.length > 0 ? "Try a different search or filter." : undefined}
            />
          )}
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
        </div>
      </Card>
    </div>
  );
}
