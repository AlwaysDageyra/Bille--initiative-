import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Inbox, AlertTriangle, ArrowRight, IdCard, RefreshCw, CheckCircle2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast, useConfirm } from "../components/Feedback";
import { Card, EmptyState, StatCard, Button } from "../components/ui";
import {
  Avatar, UrgencyChip, OverdueTag, URGENCY_STYLES, DEFAULT_URGENCY_STYLE,
} from "../components/TableControls";
import { sortByPriority, isOverdue, slaStatus } from "../utils/priority";

function ArrivalItem({ item, index, slaDays, busy, onUpdateStatus }) {
  const urgencyStyle = URGENCY_STYLES[item.urgency] || DEFAULT_URGENCY_STYLE;
  const overdue = isOverdue(item.deadline, item.status);
  const sla = slaStatus(item.routed_at, slaDays);

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

      <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap sm:gap-3">
        <UrgencyChip urgency={item.urgency} />

        {sla && (
          <span className={`text-sm font-medium ${sla.overdue ? "text-red-600" : "text-slate-500 dark:text-white/50"}`}>
            {sla.overdue ? `SLA overdue ${Math.abs(sla.daysLeft)}d` : `${sla.daysLeft}d on SLA`}
          </span>
        )}

        <Button onClick={() => onUpdateStatus(item.id, "in_progress")} disabled={busy} variant="secondary">
          <RefreshCw size={14} /> In Progress
        </Button>
        <Button onClick={() => onUpdateStatus(item.id, "closed")} disabled={busy} variant="secondary">
          <CheckCircle2 size={14} /> Closed
        </Button>

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

export default function NewArrivals() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () => api.listCorrespondence().then(setItems);

  useEffect(() => {
    load();
    api.listDepartments().then(setDepartments);
  }, []);

  const ownDepartment = departments.find((d) => d.id === user.department_id);
  const slaDays = ownDepartment?.sla_days || null;

  const arrivals = useMemo(() => sortByPriority(items.filter((c) => c.status === "routed")), [items]);
  const highUrgency = arrivals.filter((c) => c.urgency === "High").length;
  const overdueCount = arrivals.filter((c) => isOverdue(c.deadline, c.status)).length;

  const handleUpdateStatus = async (id, status) => {
    if (status === "closed") {
      const ok = await confirm({
        title: "Mark as closed?",
        message: "This marks the correspondence as resolved and complete.",
        confirmLabel: "Mark Closed",
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      await api.updateStatus(id, status, null);
      await load();
      toast.success(status === "closed" ? "Marked as Closed." : "Marked as In Progress.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">New Arrivals</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">Letters just forwarded to {user.department_name}, not yet started — sorted by priority.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:w-3/4 md:grid-cols-3">
        <StatCard icon={Inbox} label="New arrivals" value={arrivals.length} accent="blue" delay={0} />
        <StatCard icon={AlertTriangle} label="High urgency" value={highUrgency} accent="red" delay={0.05} />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdueCount} accent="red" delay={0.1} />
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {arrivals.map((item, i) => (
            <ArrivalItem key={item.id} item={item} index={i} slaDays={slaDays} busy={busy} onUpdateStatus={handleUpdateStatus} />
          ))}
        </div>
        {arrivals.length === 0 && (
          <EmptyState icon={Inbox} title="Nothing new" subtitle="No freshly forwarded letters waiting to be started right now." />
        )}
      </Card>
    </div>
  );
}
