import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, FileText, User, UserCheck, Users, Building2, Hash, Calendar,
  Clock, AlertTriangle, Gauge, Route, CheckCircle2, AlertCircle,
  RefreshCw, SendHorizonal, Sparkles, ScrollText, ExternalLink, Printer,
  Pencil, Undo2, MessageSquarePlus, X, Save, ClipboardList, UploadCloud, Trash2,
} from "lucide-react";
import { api, fileUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast, useConfirm } from "../components/Feedback";
import StatusBadge from "../components/StatusBadge";
import { Card, Button, Spinner } from "../components/ui";
import { OverdueTag, Avatar, UrgencyChip, ConfidenceChip } from "../components/TableControls";
import { isOverdue } from "../utils/priority";
import { PRE_ROUTING_STATUSES } from "../utils/status";

const ACTION_META = {
  submitted: { label: "Submitted by NGO", icon: SendHorizonal, color: "bg-slate-100 text-slate-600" },
  ai_analyzed: { label: "AI analysis completed", icon: Sparkles, color: "bg-gold-500/15 text-gold-600" },
  ai_analysis_failed: { label: "AI analysis failed", icon: AlertCircle, color: "bg-red-100 text-red-600" },
  fields_edited: { label: "Coordinator corrected fields", icon: Pencil, color: "bg-blue-100 text-blue-600" },
  routed_confirmed_ai: { label: "Routed — coordinator confirmed AI", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" },
  routed_overridden_ai: { label: "Routed — coordinator overrode AI", icon: RefreshCw, color: "bg-amber-100 text-amber-700" },
  rerouted: { label: "Re-routed by coordinator", icon: RefreshCw, color: "bg-amber-100 text-amber-700" },
  bounced_back: { label: "Sent back by department manager", icon: Undo2, color: "bg-red-100 text-red-600" },
  submitter_followup: { label: "Follow-up from submitter", icon: MessageSquarePlus, color: "bg-blue-100 text-blue-600" },
  status_in_progress: { label: "Marked in progress", icon: RefreshCw, color: "bg-purple-100 text-purple-600" },
  status_closed: { label: "Marked closed", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" },
};

const EDITABLE_TEXT_FIELDS = [
  { key: "document_type", label: "Document Type", icon: FileText },
  { key: "sender", label: "Sender", icon: User },
  { key: "recipient", label: "Recipient", icon: UserCheck },
  { key: "department_mentioned", label: "Department Mentioned", icon: Building2 },
  { key: "reference_number", label: "Reference Number", icon: Hash },
  { key: "document_date", label: "Document Date", icon: Calendar },
  { key: "deadline", label: "Deadline", icon: Clock },
];

const inputClass =
  "mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15";

function SectionHeading({ icon: Icon, title, className = "" }) {
  return (
    <div className={`mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 ${className}`}>
      <Icon size={13} />
      {title}
    </div>
  );
}

function Field({ icon: Icon, label, value, extra }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-sm font-medium text-ink-900">{value || <em className="font-normal text-slate-400">not stated</em>}</p>
          {extra}
        </div>
      </div>
    </div>
  );
}

function ChipField({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

function EditableField({ icon: Icon, label, value, onChange }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      </div>
    </div>
  );
}

function ProseBlock({ icon: Icon, label, text }) {
  return (
    <Card className="p-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon size={13} /> {label}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-900">{text || <em className="font-normal text-slate-400">not stated</em>}</p>
    </Card>
  );
}

function EditableProseBlock({ label, value, onChange }) {
  return (
    <Card className="p-5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <textarea
        rows={3}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-2 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
      />
    </Card>
  );
}

const STATUS_LABELS = { in_progress: "In Progress", closed: "Closed" };
const URGENCY_OPTIONS = ["Low", "Medium", "High"];

export default function CorrespondenceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [item, setItem] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [note, setNote] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [bounceNote, setBounceNote] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [replaceFile, setReplaceFile] = useState(null);
  const [showReroute, setShowReroute] = useState(false);
  const [showBounce, setShowBounce] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
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

  const startEditing = () => {
    setEditFields({
      document_type: item.document_type,
      sender: item.sender,
      recipient: item.recipient,
      department_mentioned: item.department_mentioned,
      reference_number: item.reference_number,
      document_date: item.document_date,
      subject: item.subject,
      deadline: item.deadline,
      urgency: item.urgency,
      main_request: item.main_request,
      required_action: item.required_action,
      policy_procedure_needed: item.policy_procedure_needed,
    });
    setEditing(true);
  };

  const handleSaveEdits = async () => {
    setBusy(true);
    try {
      await api.updateFields(id, editFields);
      setEditing(false);
      await load();
      toast.success("Changes saved.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRoute = async () => {
    const dept = departments.find((d) => d.id === Number(selectedDept));
    const isReroute = item.status === "routed";
    const ok = await confirm({
      title: `${isReroute ? "Re-route" : "Send"} to ${dept?.name}?`,
      message: isReroute
        ? "This changes the department this correspondence is sent to."
        : "This routes the correspondence to that department's manager for action.",
      confirmLabel: isReroute ? "Re-route" : "Send",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.routeCorrespondence(id, Number(selectedDept), note);
      setNote("");
      setShowReroute(false);
      await load();
      toast.success(`${isReroute ? "Re-routed" : "Routed"} to ${dept?.name}.`);
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
      await api.updateStatus(id, status, statusNote);
      setStatusNote("");
      await load();
      toast.success(`Marked as ${STATUS_LABELS[status] || status}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBounce = async () => {
    if (!bounceNote.trim()) {
      toast.error("Please explain why this is being sent back.");
      return;
    }
    const ok = await confirm({
      title: "Send back to coordinator?",
      message: "This unroutes the correspondence and returns it to the Approval Queue for re-review.",
      confirmLabel: "Send Back",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.bounceBack(id, bounceNote);
      toast.success("Sent back to coordinator.");
      // The manager loses access to this record now that it's unrouted, so
      // reloading it here would 403 — send them back to their queue instead.
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const handleFollowup = async () => {
    if (!followupNote.trim()) return;
    setBusy(true);
    try {
      await api.addFollowup(id, followupNote);
      setFollowupNote("");
      await load();
      toast.success("Follow-up added.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReplace = async () => {
    if (!replaceFile) return;
    const ok = await confirm({
      title: "Replace this document?",
      message: "The current file and AI analysis will be discarded and replaced with the new document's results.",
      confirmLabel: "Replace",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.replaceCorrespondence(id, replaceFile);
      setReplaceFile(null);
      await load();
      toast.success("Document replaced and re-analyzed.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete this submission?",
      message: "This permanently removes the letter and its history. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.deleteCorrespondence(id);
      toast.success("Submission deleted.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  if (!item) return <Spinner />;

  return (
    <div>
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-ink-900 print:hidden">
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      <Card className="mt-3 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={item.sender} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-ink-900">{item.subject || "(no subject extracted)"}</h1>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {item.sender || "Unknown sender"}
                {" · "}Submitted {new Date(item.created_at).toLocaleDateString()}
                {item.document_type && ` · ${item.document_type}`}
              </p>
            </div>
          </div>
          <div className="flex flex-none gap-2 print:hidden">
            {user.role === "coordinator" && item.status === "pending_coordinator_review" && !editing && (
              <Button variant="secondary" onClick={startEditing}>
                <Pencil size={14} /> Edit Details
              </Button>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </Button>
          </div>
        </div>
      </Card>

      {item.ai_error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 flex-none" />
          <span>AI analysis failed: {item.ai_error}</span>
        </div>
      )}

      <Card className="mt-5 p-6">
        <SectionHeading icon={FileText} title="Document" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
          {editing ? (
            <EditableField icon={FileText} label="Document Type" value={editFields.document_type} onChange={(v) => setEditFields((p) => ({ ...p, document_type: v }))} />
          ) : (
            <Field icon={FileText} label="Document Type" value={item.document_type} />
          )}
          {editing ? (
            <EditableField icon={Hash} label="Reference Number" value={editFields.reference_number} onChange={(v) => setEditFields((p) => ({ ...p, reference_number: v }))} />
          ) : (
            <Field icon={Hash} label="Reference Number" value={item.reference_number} />
          )}
          {editing ? (
            <EditableField icon={Calendar} label="Document Date" value={editFields.document_date} onChange={(v) => setEditFields((p) => ({ ...p, document_date: v }))} />
          ) : (
            <Field icon={Calendar} label="Document Date" value={item.document_date} />
          )}
        </div>

        <SectionHeading icon={Users} title="Parties" className="mb-4 mt-7 border-t border-slate-100 pt-6" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {editing ? (
            <EditableField icon={User} label="Sender" value={editFields.sender} onChange={(v) => setEditFields((p) => ({ ...p, sender: v }))} />
          ) : (
            <Field icon={User} label="Sender" value={item.sender} />
          )}
          {editing ? (
            <EditableField icon={UserCheck} label="Recipient" value={editFields.recipient} onChange={(v) => setEditFields((p) => ({ ...p, recipient: v }))} />
          ) : (
            <Field icon={UserCheck} label="Recipient" value={item.recipient} />
          )}
          {editing ? (
            <EditableField icon={Building2} label="Department Mentioned" value={editFields.department_mentioned} onChange={(v) => setEditFields((p) => ({ ...p, department_mentioned: v }))} />
          ) : (
            <Field icon={Building2} label="Department Mentioned" value={item.department_mentioned} />
          )}
        </div>

        <SectionHeading icon={Gauge} title="Priority & Routing" className="mb-4 mt-7 border-t border-slate-100 pt-6" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {editing ? (
            <EditableField icon={Clock} label="Deadline" value={editFields.deadline} onChange={(v) => setEditFields((p) => ({ ...p, deadline: v }))} />
          ) : (
            <Field
              icon={Clock}
              label="Deadline"
              value={item.deadline}
              extra={isOverdue(item.deadline, item.status) && <OverdueTag />}
            />
          )}
          {editing ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500">
                <AlertTriangle size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Urgency</label>
                <select
                  value={editFields.urgency || ""}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, urgency: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">-- not stated --</option>
                  {URGENCY_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <ChipField icon={AlertTriangle} label="Urgency"><UrgencyChip urgency={item.urgency} /></ChipField>
          )}
          <ChipField icon={Gauge} label="AI Confidence"><ConfidenceChip confidence={item.ai_confidence} /></ChipField>
          <Field icon={Route} label="AI Recommended Department" value={item.recommended_department_name} />
          <Field icon={CheckCircle2} label="Final Department" value={item.final_department_name} />
        </div>
      </Card>

      {editing ? (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <EditableProseBlock label="Main Request" value={editFields.main_request} onChange={(v) => setEditFields((p) => ({ ...p, main_request: v }))} />
          <EditableProseBlock label="Required Action" value={editFields.required_action} onChange={(v) => setEditFields((p) => ({ ...p, required_action: v }))} />
          <EditableProseBlock label="Policy/Procedure Needed" value={editFields.policy_procedure_needed} onChange={(v) => setEditFields((p) => ({ ...p, policy_procedure_needed: v }))} />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <ProseBlock icon={ClipboardList} label="Main Request" text={item.main_request} />
          <ProseBlock icon={CheckCircle2} label="Required Action" text={item.required_action} />
          <ProseBlock icon={AlertCircle} label="Policy/Procedure Needed (AI suggestion, unverified)" text={item.policy_procedure_needed} />
        </div>
      )}

      {editing && (
        <div className="mt-4 flex gap-3 print:hidden">
          <Button onClick={handleSaveEdits} disabled={busy}><Save size={15} /> Save Changes</Button>
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}><X size={15} /> Cancel</Button>
        </div>
      )}

      <details className="group mt-5 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-ink-900">
          <ScrollText size={16} className="text-slate-400" />
          Original submitted text
        </summary>
        <pre className="whitespace-pre-wrap border-t border-slate-100 px-5 py-4 font-sans text-sm leading-relaxed text-slate-600">{item.raw_text}</pre>
      </details>

      {user.role === "coordinator" && item.status === "pending_coordinator_review" && !editing && (
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

      {user.role === "coordinator" && item.status === "routed" && (
        <Card className="mt-6 p-6 print:hidden">
          {!showReroute ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Sent the wrong department by mistake?</p>
              <Button variant="secondary" onClick={() => setShowReroute(true)}>
                <RefreshCw size={14} /> Change Department
              </Button>
            </div>
          ) : (
            <>
              <h3 className="font-bold text-ink-900">Re-route this correspondence</h3>
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
                <Button onClick={handleRoute} disabled={busy || !selectedDept}>Re-route</Button>
                <Button variant="secondary" onClick={() => setShowReroute(false)} disabled={busy}>Cancel</Button>
              </div>
            </>
          )}
        </Card>
      )}

      {user.role === "dept_manager" && ["routed", "in_progress"].includes(item.status) && (
        <Card className="mt-6 p-6 print:hidden">
          <h3 className="font-bold text-ink-900">Update Status</h3>
          <label className="mt-4 block text-sm font-medium text-ink-900">
            Note (optional)
            <input
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
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

          {!showBounce ? (
            <button
              onClick={() => setShowBounce(true)}
              className="mt-4 flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-500"
            >
              <Undo2 size={14} /> This isn't for my department — send it back
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <label className="block text-sm font-medium text-red-800">
                Reason for sending back (required)
                <textarea
                  rows={2}
                  value={bounceNote}
                  onChange={(e) => setBounceNote(e.target.value)}
                  className="mt-1.5 w-full resize-y rounded-lg border border-red-300 bg-white p-2 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
                  placeholder="e.g. This is actually a Finance matter, not HR."
                />
              </label>
              <div className="mt-3 flex gap-3">
                <Button onClick={handleBounce} disabled={busy || !bounceNote.trim()} variant="danger">
                  Send Back to Coordinator
                </Button>
                <Button variant="secondary" onClick={() => setShowBounce(false)} disabled={busy}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {user.role === "submitter" && item.submitter_id === user.id && PRE_ROUTING_STATUSES.includes(item.status) && (
        <Card className="mt-6 p-6 print:hidden">
          <h3 className="font-bold text-ink-900">Manage Submission</h3>
          <p className="mt-1 text-sm text-slate-500">You can still replace the document or delete this submission — it hasn't been routed to a department yet.</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition hover:border-gold-400 hover:bg-slate-50">
              <UploadCloud size={16} />
              {replaceFile ? replaceFile.name : "Choose a replacement file (PDF, DOCX, or TXT)"}
              <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => setReplaceFile(e.target.files?.[0] || null)} />
            </label>
            <Button onClick={handleReplace} disabled={busy || !replaceFile} variant="secondary">
              <RefreshCw size={14} /> Replace &amp; Re-analyze
            </Button>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-5">
            <Button onClick={handleDelete} disabled={busy} variant="danger">
              <Trash2 size={15} /> Delete Submission
            </Button>
          </div>
        </Card>
      )}

      {user.role === "submitter" && item.submitter_id === user.id && (
        <Card className="mt-6 p-6 print:hidden">
          <h3 className="font-bold text-ink-900">Add a Follow-up</h3>
          <p className="mt-1 text-sm text-slate-500">Need to add context or respond to a request for clarification? It'll be added to the record below.</p>
          <textarea
            rows={3}
            value={followupNote}
            onChange={(e) => setFollowupNote(e.target.value)}
            placeholder="Type your follow-up note..."
            className="mt-3 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
          />
          <Button onClick={handleFollowup} disabled={busy || !followupNote.trim()} className="mt-3">
            <MessageSquarePlus size={15} /> Send Follow-up
          </Button>
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
