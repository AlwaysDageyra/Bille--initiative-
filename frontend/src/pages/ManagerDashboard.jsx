import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Send, RefreshCw, CheckCircle2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import StatusBadge, { STATUS_OPTIONS } from "../components/StatusBadge";
import { Card, EmptyState, StatCard } from "../components/ui";
import { SearchInput, Select, Pagination, OverdueTag, usePagedResult } from "../components/TableControls";
import { sortByPriority, isOverdue } from "../utils/priority";

const PAGE_SIZE = 8;
const QUEUE_STATUS_OPTIONS = STATUS_OPTIONS.filter((o) => ["routed", "in_progress", "closed"].includes(o.value));

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Sender</th>
                <th className="px-5 py-3">Deadline</th>
                <th className="px-5 py-3">Urgency</th>
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
                  <td className="px-5 py-3.5 font-medium text-ink-900">{c.subject}</td>
                  <td className="px-5 py-3.5 text-slate-600">{c.sender || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      {c.deadline || "—"}
                      {isOverdue(c.deadline, c.status) && <OverdueTag />}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{c.urgency || "—"}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3.5">
                    <Link to={`/correspondence/${c.id}`} className="font-semibold text-gold-600 hover:text-gold-500">Open</Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon={Building2}
              title={items.length === 0 ? "Nothing routed to your department yet" : "No matches"}
              subtitle={items.length > 0 ? "Try a different search or filter." : undefined}
            />
          )}
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
        </div>
      </Card>
    </div>
  );
}
