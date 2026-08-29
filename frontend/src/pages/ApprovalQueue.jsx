import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardCheck, AlertTriangle, Inbox, FileText, ArrowRight, IdCard, Send, X } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Feedback";
import { Card, EmptyState, StatCard, Button } from "../components/ui";
import {
  SearchInput, Select, Pagination, OverdueTag, usePagedResult,
  Avatar, UrgencyChip, ConfidenceChip, URGENCY_STYLES, DEFAULT_URGENCY_STYLE,
} from "../components/TableControls";
import { sortByPriority, isOverdue } from "../utils/priority";

const PAGE_SIZE = 8;

function QueueItem({ item, index, selected, onToggle }) {
  const urgencyStyle = URGENCY_STYLES[item.urgency] || DEFAULT_URGENCY_STYLE;
  const overdue = isOverdue(item.deadline, item.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
      className={`flex flex-col gap-4 border-l-4 bg-white dark:bg-ink-900 p-5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5/70 sm:flex-row sm:items-center sm:justify-between ${urgencyStyle.border}`}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(item.id)}
          className="mt-1.5 h-4 w-4 flex-none rounded border-slate-300 text-gold-500 focus:ring-gold-500/40"
          aria-label={`Select ${item.subject || "letter"}`}
        />
        <Avatar name={item.sender} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-ink-900 dark:text-white">{item.subject}</p>
            {overdue && <OverdueTag />}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500 dark:text-white/50">
            {item.sender || "Unknown sender"}
            {item.source_filename && (
              <span className="ml-2 inline-flex items-center gap-1 text-slate-400 dark:text-white/35">
                <FileText size={12} /> {item.source_filename}
              </span>
            )}
            {item.submitter_username && (
              <span className="ml-2 inline-flex items-center gap-1 text-slate-400 dark:text-white/35">
                <IdCard size={12} /> {item.submitter_username}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap sm:gap-4">
        <div className="min-w-[7rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">Recommended</p>
          <p className="text-sm font-medium text-ink-900 dark:text-white">{item.recommended_department_name || <em className="font-normal text-slate-400 dark:text-white/35">none</em>}</p>
        </div>

        <ConfidenceChip confidence={item.ai_confidence} />

        <UrgencyChip urgency={item.urgency} />

        <div className="min-w-[6.5rem] text-right sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">Deadline</p>
          <p className="text-sm text-slate-600 dark:text-white/65">{item.deadline || "—"}</p>
        </div>

        <Link
          to={`/correspondence/${item.id}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 shadow-sm transition hover:shadow-md sm:ml-0"
        >
          Review <ArrowRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}

export default function ApprovalQueue() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkTargetDept, setBulkTargetDept] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = () => api.listCorrespondence().then(setItems);

  useEffect(() => {
    load();
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

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const selectedItems = useMemo(() => pending.filter((c) => selectedIds.has(c.id)), [pending, selectedIds]);

  const handleBulkForward = async () => {
    setBulkBusy(true);
    let forwarded = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of selectedItems) {
      const deptId = bulkTargetDept ? Number(bulkTargetDept) : item.recommended_department_id;
      if (!deptId) {
        skipped++;
        continue;
      }
      try {
        await api.routeCorrespondence(item.id, deptId, null);
        forwarded++;
      } catch {
        failed++;
      }
    }

    setBulkBusy(false);
    setSelectedIds(new Set());
    setBulkTargetDept("");
    await load();

    const parts = [`${forwarded} forwarded`];
    if (skipped > 0) parts.push(`${skipped} skipped (no department to forward to)`);
    if (failed > 0) parts.push(`${failed} failed`);
    const message = parts.join(", ") + ".";
    if (failed > 0 || skipped > 0) toast.error(message);
    else toast.success(message);
  };

  const { pageItems, pageCount, safePage } = usePagedResult(filtered, page, PAGE_SIZE);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">Review Queue</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">New letters the AI has analyzed and brought here for your confirmation, sorted by priority.</p>
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
        {filtered.length > 0 && (
          <label className="ml-auto flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-white/50">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 text-gold-500 focus:ring-gold-500/40"
            />
            Select all
          </label>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gold-200 bg-gold-50 p-4 dark:border-gold-900/40 dark:bg-gold-950/20 sm:flex-row sm:items-center">
          <span className="text-sm font-semibold text-ink-900 dark:text-white">{selectedIds.size} selected</span>
          <Select
            value={bulkTargetDept}
            onChange={setBulkTargetDept}
            placeholder="Use each letter's AI recommendation"
            options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
          />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Button onClick={handleBulkForward} disabled={bulkBusy}>
              <Send size={14} /> Forward Selected
            </Button>
            <Button variant="secondary" onClick={() => setSelectedIds(new Set())} disabled={bulkBusy}>
              <X size={14} /> Clear
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {pageItems.map((item, i) => (
            <QueueItem key={item.id} item={item} index={i} selected={selectedIds.has(item.id)} onToggle={toggleSelect} />
          ))}
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={Inbox}
            title={pending.length === 0 ? "Queue is clear" : "No matches"}
            subtitle={pending.length === 0 ? "No new letters waiting for your review right now." : "Try a different search or filter."}
          />
        )}
        <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
