import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardCheck, AlertTriangle, Inbox } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, StatCard } from "../components/ui";
import { SearchInput, Select, Pagination, OverdueTag, usePagedResult } from "../components/TableControls";
import { sortByPriority, isOverdue } from "../utils/priority";

const PAGE_SIZE = 8;

export default function ApprovalQueue() {
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.listCorrespondence().then(setItems);
    api.listDepartments().then(setDepartments);
  }, []);

  const pending = useMemo(() => sortByPriority(items.filter((c) => c.status === "pending_coordinator_review")), [items]);
  const highUrgency = pending.filter((c) => c.urgency === "High").length;
  const overdueCount = pending.filter((c) => isOverdue(c.deadline, c.status)).length;

  const filtered = useMemo(() => {
    return pending.filter((c) => {
      if (deptFilter && String(c.recommended_department_id) !== deptFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${c.subject || ""} ${c.sender || ""} ${c.source_filename || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [pending, deptFilter, search]);

  const { pageItems, pageCount, safePage } = usePagedResult(filtered, page, PAGE_SIZE);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Approval Queue</h1>
        <p className="mt-1 text-sm text-slate-500">New letters the AI has analyzed and routed here for your confirmation, sorted by priority.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:w-3/4 md:grid-cols-3">
        <StatCard icon={ClipboardCheck} label="Waiting for review" value={pending.length} accent="blue" delay={0} />
        <StatCard icon={AlertTriangle} label="High urgency" value={highUrgency} accent="red" delay={0.05} />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdueCount} accent="red" delay={0.1} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search subject, sender, file..." />
        <Select
          value={deptFilter}
          onChange={(v) => { setDeptFilter(v); setPage(1); }}
          placeholder="All recommended departments"
          options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Sender</th>
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3">AI Recommended Dept</th>
                <th className="px-5 py-3">AI Confidence</th>
                <th className="px-5 py-3">Deadline</th>
                <th className="px-5 py-3">Urgency</th>
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
                  className="border-b border-slate-50 transition-colors last:border-0 hover:bg-amber-50/50"
                >
                  <td className="px-5 py-3.5 font-medium text-ink-900">{c.subject}</td>
                  <td className="px-5 py-3.5 text-slate-600">{c.sender || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-500">{c.source_filename || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-600">{c.recommended_department_name || <em className="text-slate-400">none</em>}</td>
                  <td className="px-5 py-3.5 text-slate-600">{c.ai_confidence || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      {c.deadline || "—"}
                      {isOverdue(c.deadline, c.status) && <OverdueTag />}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{c.urgency || "—"}</td>
                  <td className="px-5 py-3.5">
                    <Link to={`/correspondence/${c.id}`} className="font-semibold text-gold-600 hover:text-gold-500">Review</Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon={Inbox}
              title={pending.length === 0 ? "Queue is clear" : "No matches"}
              subtitle={pending.length === 0 ? "No new letters waiting for your review right now." : "Try a different search or filter."}
            />
          )}
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
        </div>
      </Card>
    </div>
  );
}
