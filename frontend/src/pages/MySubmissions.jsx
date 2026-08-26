import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Inbox, Clock, Send, CheckCircle2, FileText, ArrowRight, Trash2, UploadCloud, X, SendHorizonal } from "lucide-react";
import { api } from "../api";
import { useToast, useConfirm } from "../components/Feedback";
import StatusBadge, { STATUS_OPTIONS } from "../components/StatusBadge";
import { Card, Button, EmptyState, StatCard } from "../components/ui";
import { SearchInput, Select, Pagination, usePagedResult, Avatar } from "../components/TableControls";
import { PRE_ROUTING_STATUSES } from "../utils/status";

const PAGE_SIZE = 8;
const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function validateFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return "Unsupported file type. Please upload a PDF, DOCX, or TXT file.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File is too large. Maximum upload size is 10 MB.";
  }
  return null;
}

function SubmissionRow({ item, index, onDelete }) {
  const canDelete = PRE_ROUTING_STATUSES.includes(item.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
      className="flex flex-col gap-4 bg-white p-5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <Avatar name={item.subject} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-900">{item.subject || <em className="font-normal text-slate-400">(pending analysis)</em>}</p>
          <p className="mt-1 truncate text-sm text-slate-500">
            {item.source_filename && (
              <span className="inline-flex items-center gap-1">
                <FileText size={12} /> {item.source_filename}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap sm:gap-4">
        <div className="min-w-[7rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recommended</p>
          <p className="text-sm font-medium text-ink-900">{item.recommended_department_name || "—"}</p>
        </div>

        <div className="min-w-[8rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Submitted</p>
          <p className="text-sm text-slate-600">{new Date(item.created_at).toLocaleDateString()}</p>
        </div>

        <StatusBadge status={item.status} />

        {canDelete && (
          <button
            onClick={() => onDelete(item)}
            aria-label="Delete submission"
            className="grid h-9 w-9 flex-none place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={15} />
          </button>
        )}

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

export default function MySubmissions() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileError, setFileError] = useState("");
  const inputRef = useRef(null);

  const load = () => api.listCorrespondence().then(setItems);

  useEffect(() => {
    load();
  }, []);

  const pickFile = (candidate) => {
    if (!candidate) return;
    const validationError = validateFile(candidate);
    if (validationError) {
      setFileError(validationError);
      setFile(null);
      return;
    }
    setFileError("");
    setFile(candidate);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setFileError("");
    try {
      await api.createCorrespondence(file);
      setFile(null);
      await load();
      toast.success("Correspondence submitted and analyzed.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (target) => {
    const ok = await confirm({
      title: "Delete this submission?",
      message: `"${target.subject || target.source_filename}" and its history will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    try {
      await api.deleteCorrespondence(target.id);
      await load();
      toast.success("Submission deleted.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const stats = {
    total: items.length,
    pending: items.filter((c) => c.status === "pending_coordinator_review").length,
    routed: items.filter((c) => ["routed", "in_progress"].includes(c.status)).length,
    closed: items.filter((c) => c.status === "closed").length,
  };

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${c.subject || ""} ${c.source_filename || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, search]);

  const { pageItems, pageCount, safePage } = usePagedResult(filtered, page, PAGE_SIZE);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">My Submissions</h1>
        <p className="mt-1 text-sm text-slate-500">Upload correspondence and track it through review and routing.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Inbox} label="Total submitted" value={stats.total} accent="gold" delay={0} />
        <StatCard icon={Clock} label="Pending review" value={stats.pending} accent="blue" delay={0.05} />
        <StatCard icon={Send} label="Routed" value={stats.routed} accent="purple" delay={0.1} />
        <StatCard icon={CheckCircle2} label="Closed" value={stats.closed} accent="emerald" delay={0.15} />
      </div>

      <Card className="mb-8 p-6">
        <h2 className="mb-3 font-bold text-ink-900">Submit new correspondence</h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />

          {!file ? (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragActive ? "border-gold-500 bg-gold-500/5" : "border-slate-300 hover:border-gold-400 hover:bg-slate-50"
              }`}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-500/10 text-gold-600">
                <UploadCloud size={22} />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-900">Click to upload or drag and drop</p>
              <p className="mt-1 text-xs text-slate-400">PDF, DOCX, or TXT &middot; Max 10 MB</p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-gold-500/15 text-gold-600">
                  <FileText size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
                className="grid h-7 w-7 flex-none place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                aria-label="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {fileError && <p className="mt-3 text-sm font-medium text-red-600">{fileError}</p>}

          <Button type="submit" disabled={submitting || !file} className="mt-4">
            <SendHorizonal size={16} />
            {submitting ? "Analyzing with AI (this can take up to a minute)..." : "Submit"}
          </Button>
        </form>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search subject, file..." />
        <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="All statuses" options={STATUS_OPTIONS} />
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          {pageItems.map((item, i) => (
            <SubmissionRow key={item.id} item={item} index={i} onDelete={handleDelete} />
          ))}
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={Inbox}
            title={items.length === 0 ? "No submissions yet" : "No matches"}
            subtitle={items.length === 0 ? "Upload a letter or memo above to get started." : "Try a different search or filter."}
          />
        )}
        <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
