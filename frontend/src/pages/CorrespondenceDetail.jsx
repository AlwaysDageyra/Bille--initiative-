import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, FileText, User, UserCheck, Building2, Hash, Calendar,
  Clock, AlertTriangle, Gauge, Route, CheckCircle2, AlertCircle,
  RefreshCw, SendHorizonal, Sparkles, ScrollText, ExternalLink, Printer,
} from "lucide-react";
import { api, fileUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast, useConfirm } from "../components/Feedback";
import StatusBadge from "../components/StatusBadge";
import { Card, Button, Spinner } from "../components/ui";
import { OverdueTag } from "../components/TableControls";
import { isOverdue } from "../utils/priority";

const ACTION_META = {
  submitted: { label: "Submitted by NGO", icon: SendHorizonal, color: "bg-slate-100 text-slate-600" },
  ai_analyzed: { label: "AI analysis completed", icon: Sparkles, color: "bg-gold-500/15 text-gold-600" },
  ai_analysis_failed: { label: "AI analysis failed", icon: AlertCircle, color: "bg-red-100 text-red-600" },
  routed_confirmed_ai: { label: "Routed — coordinator confirmed AI", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" },
  routed_overridden_ai: { label: "Routed — coordinator overrode AI", icon: RefreshCw, color: "bg-amber-100 text-amber-700" },
  status_in_progress: { label: "Marked in progress", icon: RefreshCw, color: "bg-purple-100 text-purple-600" },
  status_closed: { label: "Marked closed", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" },
};

function Field({ icon: Icon, label, value, extra }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-sm font-medium text-ink-900">{value || <em className="font-normal text-slate-400">not stated</em>}</p>
          {extra}
        </div>
      </div>
    </div>
  );
}

function ProseBlock({ label, text }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-900">{text || <em className="font-normal text-slate-400">not stated</em>}</p>
    </Card>
  );
}

const STATUS_LABELS = { in_progress: "In Progress", closed: "Closed" };

export default function CorrespondenceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [item, setItem] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const data = await api.getCorrespondence(id);
    setItem(data);
    setSelectedDept(data.recommended_department_id || "");
  };

  useEffect(() => {
    load();
    api.listDepartments().then(setDepartments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleRoute = async () => {
    const dept = departments.find((d) => d.id === Number(selectedDept));
    const ok = await confirm({
      title: `Send to ${dept?.name}?`,
      message: "This routes the correspondence to that department's manager for action.",
      confirmLabel: "Send",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.routeCorrespondence(id, Number(selectedDept), note);
      setNote("");
      await load();
      toast.success(`Routed to ${dept?.name}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReanalyze = async () => {
    setBusy(true);
    try {
      await api.reanalyze(id);
      await load();
      toast.success("AI analysis re-run.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (status) => {
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
      await api.updateStatus(id, status, note);
      setNote("");
      await load();
      toast.success(`Marked as ${STATUS_LABELS[status] || status}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!item) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between print:hidden">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-ink-900">
          <ArrowLeft size={15} /> Back to dashboard
        </Link>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={15} /> Print / Export PDF
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{item.subject || "(no subject extracted)"}</h1>
        <StatusBadge status={item.status} />
      </div>

      {item.ai_error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 flex-none" />
          <span>AI analysis failed: {item.ai_error}</span>
        </div>
      )}

      <Card className="mt-6 grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500">
            <FileText size={15} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Source File</p>
            {item.has_file ? (
              <a
                href={fileUrl(item.id)}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-gold-600 hover:text-gold-500"
              >
                {item.source_filename} <ExternalLink size={13} />
              </a>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-ink-900">{item.source_filename || <em className="font-normal text-slate-400">not stated</em>}</p>
            )}
          </div>
        </div>
        <Field icon={FileText} label="Document Type" value={item.document_type} />
        <Field icon={User} label="Sender" value={item.sender} />
        <Field icon={UserCheck} label="Recipient" value={item.recipient} />
        <Field icon={Building2} label="Department Mentioned" value={item.department_mentioned} />
        <Field icon={Hash} label="Reference Number" value={item.reference_number} />
        <Field icon={Calendar} label="Document Date" value={item.document_date} />
        <Field
          icon={Clock}
          label="Deadline"
          value={item.deadline}
          extra={isOverdue(item.deadline, item.status) && <OverdueTag />}
        />
        <Field icon={AlertTriangle} label="Urgency" value={item.urgency} />
        <Field icon={Gauge} label="AI Confidence" value={item.ai_confidence} />
        <Field icon={Route} label="AI Recommended Department" value={item.recommended_department_name} />
        <Field icon={CheckCircle2} label="Final Department" value={item.final_department_name} />
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ProseBlock label="Main Request" text={item.main_request} />
        <ProseBlock label="Required Action" text={item.required_action} />
        <ProseBlock label="Policy/Procedure Needed (AI suggestion, unverified)" text={item.policy_procedure_needed} />
      </div>

      <details className="group mt-5 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-ink-900">
          <ScrollText size={16} className="text-slate-400" />
          Original submitted text
        </summary>
        <pre className="whitespace-pre-wrap border-t border-slate-100 px-5 py-4 font-sans text-sm leading-relaxed text-slate-600">{item.raw_text}</pre>
      </details>

      {user.role === "coordinator" && item.status === "pending_coordinator_review" && (
        <Card className="mt-6 p-6 print:hidden">
          <h3 className="font-bold text-ink-900">Route this correspondence</h3>
          <label className="mt-4 block text-sm font-medium text-ink-900">
            Department
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
            >
              <option value="">-- select department --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium text-ink-900">
            Note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleRoute} disabled={busy || !selectedDept}>Send to Department</Button>
            <Button onClick={handleReanalyze} disabled={busy} variant="secondary">
              <RefreshCw size={15} /> Re-run AI Analysis
            </Button>
          </div>
        </Card>
      )}

      {user.role === "dept_manager" && ["routed", "in_progress"].includes(item.status) && (
        <Card className="mt-6 p-6 print:hidden">
          <h3 className="font-bold text-ink-900">Update Status</h3>
          <label className="mt-4 block text-sm font-medium text-ink-900">
            Note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            {item.status === "routed" && (
              <Button onClick={() => handleStatus("in_progress")} disabled={busy}>Mark In Progress</Button>
            )}
            <Button onClick={() => handleStatus("closed")} disabled={busy} variant={item.status === "routed" ? "secondary" : "primary"}>
              Mark Closed
            </Button>
          </div>
        </Card>
      )}

      <h3 className="mb-4 mt-8 font-bold text-ink-900">Action History</h3>
      <div className="relative ml-4 space-y-6 border-l-2 border-slate-200 pl-8">
        {item.history.map((h, i) => {
          const meta = ACTION_META[h.action] || { label: h.action, icon: Clock, color: "bg-slate-100 text-slate-600" };
          const Icon = meta.icon;
          return (
            <motion.div
              key={h.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="relative"
            >
              <span className={`absolute -left-[38px] grid h-7 w-7 place-items-center rounded-full ring-4 ring-[#f4f6fb] ${meta.color}`}>
                <Icon size={13} />
              </span>
              <p className="text-sm font-semibold text-ink-900">{meta.label}</p>
              <p className="text-xs text-slate-400">{h.actor_username} &middot; {new Date(h.timestamp).toLocaleString()}</p>
              {h.note && <p className="mt-1 text-sm text-slate-600">{h.note}</p>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
