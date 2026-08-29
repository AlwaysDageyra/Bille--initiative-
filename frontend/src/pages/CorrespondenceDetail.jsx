import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, ExternalLink, Printer, Pencil, Undo2, MessageSquarePlus, MessageSquare, X, Save,
  RefreshCw, SendHorizonal, Sparkles, AlertCircle, CheckCircle2, ScrollText,
  UploadCloud, Trash2, Clock, Send, FileText, Lock,
} from "lucide-react";
import { api, fileUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast, useConfirm } from "../components/Feedback";
import StatusBadge from "../components/StatusBadge";
import { Button, Spinner } from "../components/ui";
import { OverdueTag, UrgencyChip, ConfidenceChip } from "../components/TableControls";
import { isOverdue } from "../utils/priority";
import { PRE_ROUTING_STATUSES } from "../utils/status";

const ACTION_META = {
  submitted: { label: "Submitted by NGO", icon: SendHorizonal },
  ai_analyzed: { label: "AI analysis completed", icon: Sparkles },
  ai_analysis_failed: { label: "AI analysis failed", icon: AlertCircle },
  fields_edited: { label: "Coordinator corrected fields", icon: Pencil },
  routed_confirmed_ai: { label: "Forwarded — coordinator confirmed AI", icon: CheckCircle2 },
  routed_overridden_ai: { label: "Forwarded — coordinator overrode AI", icon: RefreshCw },
  rerouted: { label: "Re-forwarded by coordinator", icon: RefreshCw },
  bounced_back: { label: "Sent back by department manager", icon: Undo2 },
  submitter_followup: { label: "Follow-up from submitter", icon: MessageSquarePlus },
  coordinator_feedback: { label: "Feedback from coordinator", icon: MessageSquare },
  internal_note: { label: "Internal note (staff only)", icon: Lock },
  status_in_progress: { label: "Marked in progress", icon: RefreshCw },
  status_closed: { label: "Marked closed", icon: CheckCircle2 },
};

const AI_ANALYSIS_ACTIONS = new Set(["ai_analyzed", "ai_analysis_failed"]);

// The submitter isn't meant to know an LLM is involved, so their timeline
// gets plain-language labels and no AI-revealing notes (recommended
// department, confirm/override distinction, raw extraction errors).
const SUBMITTER_ACTION_LABELS = {
  ai_analyzed: "Submission processed",
  ai_analysis_failed: "Submission needs manual review",
  routed_confirmed_ai: "Forwarded to department",
  routed_overridden_ai: "Forwarded to department",
};
// Only these two actions' notes actually expose AI internals (recommended
// department, raw extraction error) — routed_confirmed_ai/overridden_ai's
// note is just "Sent to {department}", which is fine to show.
const AI_REVEALING_NOTE_ACTIONS = new Set(["ai_analyzed", "ai_analysis_failed"]);

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 dark:border-white/15 px-3 py-2 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15";

const ghostBtn = "inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-white/50 transition hover:text-ink-900";
const label = "text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35";

function Detail({ term, value, extra }) {
  return (
    <div>
      <dt className={label}>{term}</dt>
      <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-900 dark:text-white">
        {value || <em className="font-normal text-slate-400 dark:text-white/35">not stated</em>}
        {extra}
      </dd>
    </div>
  );
}

function ChipDetail({ term, children }) {
  return (
    <div>
      <dt className={label}>{term}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

function EditableDetail({ term, value, onChange }) {
  return (
    <div>
      <label className={label}>{term}</label>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

function Prose({ heading, text }) {
  return (
    <div>
      <h3 className={label}>{heading}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-900 dark:text-white">{text || <em className="font-normal text-slate-400 dark:text-white/35">not stated</em>}</p>
    </div>
  );
}

function EditableProse({ heading, value, onChange }) {
  return (
    <div>
      <label className={label}>{heading}</label>
      <textarea
        rows={2}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 dark:border-white/15 p-2.5 text-sm leading-relaxed outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
      />
    </div>
  );
}

function Section({ heading, children, className = "" }) {
  return (
    <section className={`border-t border-slate-200 dark:border-white/10 py-6 first:border-t-0 first:pt-0 ${className}`}>
      {heading && <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">{heading}</h2>}
      {children}
    </section>
  );
}

const PANEL_ACCENTS = {
  gold: "bg-gold-500/15 text-gold-600",
  blue: "bg-blue-500/15 text-blue-600",
  amber: "bg-amber-500/15 text-amber-600",
  red: "bg-red-500/15 text-red-600",
  slate: "bg-slate-500/15 text-slate-600 dark:text-white/65",
};

function ActionPanel({ icon: Icon, accent = "gold", title, headerAction, children }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 shadow-sm print:hidden">
      {title ? (
        <>
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              {Icon && (
                <span className={`grid h-8 w-8 flex-none place-items-center rounded-full ${PANEL_ACCENTS[accent]}`}>
                  <Icon size={15} />
                </span>
              )}
              <h3 className="text-sm font-bold text-ink-900 dark:text-white">{title}</h3>
            </div>
            {headerAction}
          </div>
          <div className="border-t border-slate-100 dark:border-white/10 px-6 py-5">{children}</div>
        </>
      ) : (
        <div className="p-5">{children}</div>
      )}
    </div>
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
  const [feedbackNote, setFeedbackNote] = useState("");
  const [internalNoteText, setInternalNoteText] = useState("");
  const [replaceFile, setReplaceFile] = useState(null);
  const [showReroute, setShowReroute] = useState(false);
  const [showBounce, setShowBounce] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [busy, setBusy] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const prevStatusRef = useRef(null);

  const load = async () => {
    const data = await api.getCorrespondence(id);

    // Notify once processing actually finishes, whether that's the initial
    // extraction after upload or a manual re-run — not just at the moment
    // the request was kicked off. The submitter never sees AI/LLM wording
    // elsewhere in the app, so keep this consistent for them too.
    if (prevStatusRef.current === "submitted" && data.status !== "submitted") {
      const failed = data.status === "ai_analyzed" && data.ai_error;
      if (user.role === "submitter") {
        if (failed) {
          toast.error("We had trouble processing this submission automatically — a coordinator will review it manually.");
        } else {
          toast.success("Submission successfully received.");
        }
      } else if (failed) {
        toast.error("AI analysis failed: " + data.ai_error);
      } else {
        toast.success("AI analysis complete.");
      }
    }
    prevStatusRef.current = data.status;

    setItem(data);
    setSelectedDept(data.recommended_department_id || "");
  };

  useEffect(() => {
    load();
    api.listDepartments().then(setDepartments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The initial extraction runs in the background after upload, so poll
  // while it's still in flight — this is how the page picks up the result
  // without the viewer having to refresh manually. Non-blocking: everything
  // else on the page (and navigating away) still works while this runs.
  useEffect(() => {
    if (item?.status !== "submitted") return;
    const interval = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.status]);

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
      title: `${isReroute ? "Re-forward" : "Forward"} to ${dept?.name}?`,
      message: isReroute
        ? "This changes the department this correspondence is forwarded to."
        : "This forwards the correspondence to that department's manager for action.",
      confirmLabel: isReroute ? "Re-forward" : "Forward",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.routeCorrespondence(id, Number(selectedDept), note);
      setNote("");
      setShowReroute(false);
      await load();
      toast.success(`${isReroute ? "Re-forwarded" : "Forwarded"} to ${dept?.name}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReanalyze = async () => {
    setBusy(true);
    setReanalyzing(true);
    try {
      await api.reanalyze(id);
      await load();
      toast.success("AI analysis re-run.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setReanalyzing(false);
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
      message: "This returns the correspondence to the Review Queue for re-review.",
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

  const handleSendFeedback = async () => {
    if (!feedbackNote.trim()) return;
    setBusy(true);
    try {
      await api.sendFeedback(id, feedbackNote);
      setFeedbackNote("");
      await load();
      toast.success("Feedback sent to the submitter.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (!internalNoteText.trim()) return;
    setBusy(true);
    try {
      await api.addInternalNote(id, internalNoteText);
      setInternalNoteText("");
      await load();
      toast.success("Internal note added.");
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

  // The submitter (NGO) can track their letter's progress but was never meant
  // to know an LLM is doing the triage — confidence scores, which department
  // the AI recommended, and unverified AI policy suggestions stay internal.
  const isSubmitterView = user.role === "submitter";

  // Re-running AI analysis logs a new history entry each time, which is useful
  // for debugging but noisy for a reviewer — only the latest one is relevant,
  // so earlier ai_analyzed/ai_analysis_failed entries are hidden here (the full
  // trail still exists in the database, this only affects what's displayed).
  const lastAiAnalysisIndex = item.history.reduce(
    (last, h, i) => (AI_ANALYSIS_ACTIONS.has(h.action) ? i : last),
    -1
  );
  const visibleHistory = item.history.filter((h, i) => {
    if (isSubmitterView && h.action === "internal_note") return false;
    return !AI_ANALYSIS_ACTIONS.has(h.action) || i === lastAiAnalysisIndex;
  });

  // The most recent coordinator message deserves a prominent spot near the
  // top of the page — otherwise it's just one more line buried at the
  // bottom of Action History, easy for a submitter to miss entirely.
  const latestFeedback = [...item.history].reverse().find((h) => h.action === "coordinator_feedback");

  // Covers both the initial background extraction right after upload and a
  // manual re-run — the rest of the page (routing panels, history, printing,
  // navigating away) stays usable while this is happening; it's not a
  // blocking overlay.
  const isProcessing = item.status === "submitted" || reanalyzing;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/dashboard" className={`${ghostBtn} print:hidden`}>
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      <header className="mt-4 border-b border-slate-200 dark:border-white/10 pb-6">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={item.status} simplified={isSubmitterView} />
          <div className="flex items-center gap-5 print:hidden">
            {user.role === "coordinator" && item.status === "pending_coordinator_review" && !editing && (
              <button onClick={startEditing} className={ghostBtn}>
                <Pencil size={14} /> Edit Details
              </button>
            )}
            <button onClick={() => window.print()} className={ghostBtn}>
              <Printer size={15} /> Print
            </button>
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink-900 dark:text-white">{item.subject || "(no subject extracted)"}</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-white/50">
          {item.sender || "Unknown sender"}
          {" · "}Submitted {new Date(item.created_at).toLocaleDateString()}
          {item.document_type && ` · ${item.document_type}`}
          {item.final_department_name && ` · Forwarded to ${item.final_department_name}`}
        </p>
      </header>

      {latestFeedback && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-blue-500/15 text-blue-600">
            <MessageSquare size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Message from {latestFeedback.actor_username}
            </p>
            <p className="mt-1 text-sm text-ink-900 dark:text-white">{latestFeedback.note}</p>
            <p className="mt-1 text-xs text-blue-600/70 dark:text-blue-400/60">{new Date(latestFeedback.timestamp).toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 shadow-sm">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-gold-50 to-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-gold-500/15 text-gold-600">
              {isSubmitterView ? <FileText size={16} /> : <Sparkles size={16} />}
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink-900 dark:text-white">{isSubmitterView ? "Submission Details" : "AI Extraction"}</h2>
              <p className="text-xs text-slate-400 dark:text-white/35">
                {isSubmitterView ? "What we've recorded about your submission" : "Everything the model pulled from this document, in one place"}
              </p>
            </div>
          </div>
          {!editing && !isSubmitterView && <ConfidenceChip confidence={item.ai_confidence} />}
        </div>

        <div className="p-6">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 dark:border-white/10 border-t-gold-500" />
              <p className="text-sm font-medium text-ink-900 dark:text-white">
                {isSubmitterView ? "We're processing your submission..." : "Analyzing document..."}
              </p>
              <p className="max-w-sm text-xs text-slate-400 dark:text-white/35">
                This can take up to a minute — feel free to navigate away, this page will update automatically.
              </p>
            </div>
          ) : (
          <>
          {item.ai_error && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-none" />
              <span>
                {isSubmitterView
                  ? "We're having trouble processing this submission automatically — a coordinator will review it manually."
                  : `AI analysis failed: ${item.ai_error}`}
              </span>
            </div>
          )}

          <dl className={`grid grid-cols-2 gap-x-6 gap-y-5 ${isSubmitterView ? "" : "sm:grid-cols-3"}`}>
            {editing ? (
              <EditableDetail term="Deadline" value={editFields.deadline} onChange={(v) => setEditFields((p) => ({ ...p, deadline: v }))} />
            ) : (
              <Detail
                term="Deadline"
                value={item.deadline}
                extra={isOverdue(item.deadline, item.status) && <OverdueTag />}
              />
            )}
            {editing ? (
              <div>
                <label className={label}>Urgency</label>
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
            ) : (
              <ChipDetail term="Urgency"><UrgencyChip urgency={item.urgency} /></ChipDetail>
            )}
            {!isSubmitterView && <Detail term="AI Recommended Department" value={item.recommended_department_name} />}
          </dl>

          <div className="mt-6 border-t border-slate-100 dark:border-white/10 pt-6">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Detail
                  term="Source File"
                  value={
                    item.has_file ? (
                      <a
                        href={fileUrl(item.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-gold-600 hover:text-gold-500"
                      >
                        {item.source_filename} <ExternalLink size={13} />
                      </a>
                    ) : (
                      item.source_filename
                    )
                  }
                />
              </div>
              {editing ? (
                <EditableDetail term="Document Type" value={editFields.document_type} onChange={(v) => setEditFields((p) => ({ ...p, document_type: v }))} />
              ) : (
                <Detail term="Document Type" value={item.document_type} />
              )}
              {editing ? (
                <EditableDetail term="Reference Number" value={editFields.reference_number} onChange={(v) => setEditFields((p) => ({ ...p, reference_number: v }))} />
              ) : (
                <Detail term="Reference Number" value={item.reference_number} />
              )}
              {editing ? (
                <EditableDetail term="Document Date" value={editFields.document_date} onChange={(v) => setEditFields((p) => ({ ...p, document_date: v }))} />
              ) : (
                <Detail term="Document Date" value={item.document_date} />
              )}
              {editing ? (
                <EditableDetail term="Sender" value={editFields.sender} onChange={(v) => setEditFields((p) => ({ ...p, sender: v }))} />
              ) : (
                <Detail term="Sender" value={item.sender} />
              )}
              {editing ? (
                <EditableDetail term="Recipient" value={editFields.recipient} onChange={(v) => setEditFields((p) => ({ ...p, recipient: v }))} />
              ) : (
                <Detail term="Recipient" value={item.recipient} />
              )}
              {editing ? (
                <EditableDetail term="Department Mentioned" value={editFields.department_mentioned} onChange={(v) => setEditFields((p) => ({ ...p, department_mentioned: v }))} />
              ) : (
                <Detail term="Department Mentioned" value={item.department_mentioned} />
              )}
            </dl>
          </div>

          <div className="mt-6 space-y-5 border-t border-slate-100 dark:border-white/10 pt-6">
            {editing ? (
              <>
                <EditableProse heading="Main Request" value={editFields.main_request} onChange={(v) => setEditFields((p) => ({ ...p, main_request: v }))} />
                <EditableProse heading="Required Action" value={editFields.required_action} onChange={(v) => setEditFields((p) => ({ ...p, required_action: v }))} />
                <EditableProse heading="Policy/Procedure Needed" value={editFields.policy_procedure_needed} onChange={(v) => setEditFields((p) => ({ ...p, policy_procedure_needed: v }))} />
              </>
            ) : (
              <>
                <Prose heading="Main Request" text={item.main_request} />
                <Prose heading="Required Action" text={item.required_action} />
                {!isSubmitterView && (
                  <Prose heading="Policy/Procedure Needed (AI suggestion, unverified)" text={item.policy_procedure_needed} />
                )}
              </>
            )}
          </div>
          </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-6 flex gap-2.5 print:hidden">
          <Button onClick={handleSaveEdits} disabled={busy}><Save size={15} /> Save Changes</Button>
          <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}><X size={15} /> Cancel</Button>
        </div>
      )}

      <details className="group mt-6 border-t border-slate-200 dark:border-white/10 pt-6">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white">
          <ScrollText size={15} className="text-slate-400 dark:text-white/35" />
          Original submitted text
        </summary>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-600 dark:text-white/65">{item.raw_text}</pre>
      </details>

      {user.role === "coordinator" && item.status === "pending_coordinator_review" && !editing && (
        <ActionPanel
          icon={Send}
          title="Forward this correspondence"
          headerAction={
            <button onClick={handleReanalyze} disabled={busy} className={ghostBtn}>
              {reanalyzing ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 dark:border-white/15 border-t-gold-500" />
              ) : (
                <RefreshCw size={13} />
              )}
              {reanalyzing ? "Analyzing..." : "Re-run AI Analysis"}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-900 dark:text-white">
              Department
              <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className={inputClass}>
                <option value="">-- select department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-ink-900 dark:text-white">
              Note (optional)
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </label>
          </div>
          <Button onClick={handleRoute} disabled={busy || !selectedDept} className="mt-4">Send to Department</Button>
        </ActionPanel>
      )}

      {user.role === "coordinator" && item.status === "routed" && (
        <ActionPanel>
          {!showReroute ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-white/50">Sent the wrong department by mistake?</p>
              <Button variant="secondary" onClick={() => setShowReroute(true)}>
                <RefreshCw size={14} /> Change Department
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className={`grid h-8 w-8 flex-none place-items-center rounded-full ${PANEL_ACCENTS.amber}`}>
                  <RefreshCw size={15} />
                </span>
                <h3 className="text-sm font-bold text-ink-900 dark:text-white">Re-forward this correspondence</h3>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink-900 dark:text-white">
                  Department
                  <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className={inputClass}>
                    <option value="">-- select department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-ink-900 dark:text-white">
                  Note (optional)
                  <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={handleRoute} disabled={busy || !selectedDept}>Re-forward</Button>
                <Button variant="secondary" onClick={() => setShowReroute(false)} disabled={busy}>Cancel</Button>
              </div>
            </>
          )}
        </ActionPanel>
      )}

      {user.role === "dept_manager" && ["routed", "in_progress"].includes(item.status) && (
        <ActionPanel icon={CheckCircle2} accent="blue" title="Update Status">
          <label className="block text-sm font-medium text-ink-900 dark:text-white">
            Note (optional)
            <input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} className={inputClass} />
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
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <label className="block text-sm font-medium text-red-800">
                Reason for sending back (required)
                <textarea
                  rows={2}
                  value={bounceNote}
                  onChange={(e) => setBounceNote(e.target.value)}
                  className="mt-1.5 w-full resize-y rounded-lg border border-red-300 bg-white dark:bg-ink-900 p-2 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
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
        </ActionPanel>
      )}

      {user.role === "submitter" && item.submitter_id === user.id && PRE_ROUTING_STATUSES.includes(item.status) && (
        <ActionPanel icon={UploadCloud} accent="blue" title="Manage Submission">
          <p className="text-sm text-slate-500 dark:text-white/50">You can still replace the document or delete this submission — it hasn't been forwarded to a department yet.</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-white/15 px-4 py-3 text-sm text-slate-500 dark:text-white/50 transition hover:border-gold-400 hover:bg-slate-50 dark:hover:bg-white/5">
              <UploadCloud size={16} />
              {replaceFile ? replaceFile.name : "Choose a replacement file (PDF, DOCX, or TXT)"}
              <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => setReplaceFile(e.target.files?.[0] || null)} />
            </label>
            <Button onClick={handleReplace} disabled={busy || !replaceFile} variant="secondary">
              <RefreshCw size={14} /> Replace &amp; Re-analyze
            </Button>
          </div>

          <div className="mt-5 border-t border-slate-100 dark:border-white/10 pt-5">
            <Button onClick={handleDelete} disabled={busy} variant="danger">
              <Trash2 size={15} /> Delete Submission
            </Button>
          </div>
        </ActionPanel>
      )}

      {user.role === "submitter" && item.submitter_id === user.id && (
        <ActionPanel icon={MessageSquarePlus} accent="blue" title="Add a Follow-up">
          <p className="text-sm text-slate-500 dark:text-white/50">Need to add context or respond to a request for clarification? It'll be added to the record below.</p>
          <textarea
            rows={3}
            value={followupNote}
            onChange={(e) => setFollowupNote(e.target.value)}
            placeholder="Type your follow-up note..."
            className="mt-3 w-full resize-y rounded-lg border border-slate-300 dark:border-white/15 p-3 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
          />
          <Button onClick={handleFollowup} disabled={busy || !followupNote.trim()} className="mt-3">
            <MessageSquarePlus size={15} /> Send Follow-up
          </Button>
        </ActionPanel>
      )}

      {user.role === "coordinator" && (
        <ActionPanel icon={MessageSquare} accent="blue" title="Send Feedback to Submitter">
          <p className="text-sm text-slate-500 dark:text-white/50">Let the submitter know their letter was received, or share any update — it's added to the record below, visible to them.</p>
          <textarea
            rows={3}
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.target.value)}
            placeholder="e.g. We've received your letter and it's being reviewed."
            className="mt-3 w-full resize-y rounded-lg border border-slate-300 dark:border-white/15 p-3 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
          />
          <Button onClick={handleSendFeedback} disabled={busy || !feedbackNote.trim()} className="mt-3">
            <MessageSquare size={15} /> Send Feedback
          </Button>
        </ActionPanel>
      )}

      {(user.role === "coordinator" || user.role === "dept_manager") && (
        <ActionPanel icon={Lock} accent="slate" title="Internal Note (Staff Only)">
          <p className="text-sm text-slate-500 dark:text-white/50">Visible only to coordinators and department managers — never to the submitter. Useful for handoffs like "started this, following up Monday."</p>
          <textarea
            rows={3}
            value={internalNoteText}
            onChange={(e) => setInternalNoteText(e.target.value)}
            placeholder="Type a private note for staff..."
            className="mt-3 w-full resize-y rounded-lg border border-slate-300 dark:border-white/15 p-3 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
          />
          <Button onClick={handleAddInternalNote} disabled={busy || !internalNoteText.trim()} variant="secondary" className="mt-3">
            <Lock size={15} /> Add Internal Note
          </Button>
        </ActionPanel>
      )}

      <Section heading="Action History">
        <ul className="space-y-4">
          {visibleHistory.map((h) => {
            const meta = ACTION_META[h.action] || { label: h.action, icon: Clock };
            const Icon = meta.icon;
            const displayLabel = (isSubmitterView && SUBMITTER_ACTION_LABELS[h.action]) || meta.label;
            const showNote = h.note && !(isSubmitterView && AI_REVEALING_NOTE_ACTIONS.has(h.action));
            return (
              <li key={h.id} className="flex gap-3">
                <Icon size={14} className="mt-0.5 flex-none text-slate-400 dark:text-white/35" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900 dark:text-white">{displayLabel}</p>
                  <p className="text-xs text-slate-400 dark:text-white/35">{h.actor_username} &middot; {new Date(h.timestamp).toLocaleString()}</p>
                  {showNote && <p className="mt-0.5 text-sm text-slate-600 dark:text-white/65">{h.note}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
