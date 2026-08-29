import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Inbox, FileText, ArrowRight, Trash2, UploadCloud, X, SendHorizonal } from "lucide-react";
import { api } from "../api";
import { useToast, useConfirm } from "../components/Feedback";
import StatusBadge, { STATUS_OPTIONS } from "../components/StatusBadge";
import { Card, Button, EmptyState } from "../components/ui";
import { SearchInput, Select, Pagination, usePagedResult, Avatar } from "../components/TableControls";
import { PRE_ROUTING_STATUSES } from "../utils/status";

const PAGE_SIZE = 8;
const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

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
      className="flex flex-col gap-4 bg-white dark:bg-ink-900 p-5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5/70 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <Avatar name={item.subject} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-900 dark:text-white">
            {item.subject || (
              <em className="inline-flex items-center gap-1.5 font-normal text-slate-400 dark:text-white/35">
                <span className="h-3 w-3 flex-none animate-spin rounded-full border-2 border-slate-300 dark:border-white/15 border-t-gold-500" />
                Processing your submission...
              </em>
            )}
          </p>
          <p className="mt-1 truncate text-sm text-slate-500 dark:text-white/50">
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">Recommended</p>
          <p className="text-sm font-medium text-ink-900 dark:text-white">{item.recommended_department_name || "—"}</p>
        </div>

        <div className="min-w-[8rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">Submitted</p>
          <p className="text-sm text-slate-600 dark:text-white/65">{new Date(item.created_at).toLocaleDateString()}</p>
        </div>

        <StatusBadge status={item.status} simplified />

        {canDelete && (
          <button
            onClick={() => onDelete(item)}
            aria-label="Delete submission"
            className="grid h-9 w-9 flex-none place-items-center rounded-xl text-slate-400 dark:text-white/35 transition hover:bg-red-50 hover:text-red-600"
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
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileError, setFileError] = useState("");
  const inputRef = useRef(null);

  const prevItemsRef = useRef([]);

  const load = async () => {
    const data = await api.listCorrespondence();

    // Notify on each item that just finished processing since the last load
    // (still "submitted" before, something else now) — this is how a
    // submitter learns their upload actually went through, beyond the
    // immediate "received" toast fired at upload time itself.
    for (const item of data) {
      const prev = prevItemsRef.current.find((p) => p.id === item.id);
      if (prev?.status === "submitted" && item.status !== "submitted") {
        if (item.status === "ai_analyzed") {
          toast.error(`"${item.source_filename}" — we had trouble processing this automatically. A coordinator will review it manually.`);
        } else {
          toast.success(`"${item.subject || item.source_filename}" — submission successfully received.`);
        }
      }
    }

    prevItemsRef.current = data;
    setItems(data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extraction happens in the background after upload, so poll for a bit
  // while anything is still "submitted" — this is how the status transitions
  // to "Pending Review" without the submitter having to refresh manually.
  useEffect(() => {
    if (!items.some((c) => c.status === "submitted")) return;
    // Swallow errors from polls that outlive the page (e.g. navigating away
    // aborts the in-flight fetch) — nothing to report to the user for those.
    const interval = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(interval);
  }, [items]);

  // Each file becomes its own independent correspondence record — a batch
  // upload is just a convenience for attaching several unrelated letters at
  // once, not one bundled record, since they may end up at different
  // departments.
  const pickFiles = (candidates) => {
    if (!candidates || candidates.length === 0) return;

    setFiles((current) => {
      const next = [...current];
      const problems = [];

      for (const candidate of Array.from(candidates)) {
        if (next.length + 1 > MAX_FILES) {
          problems.push(`Only up to ${MAX_FILES} files per submission — the rest were skipped.`);
          break;
        }
        const validationError = validateFile(candidate);
        if (validationError) {
          problems.push(`${candidate.name}: ${validationError}`);
          continue;
        }
        if (next.some((f) => f.name === candidate.name && f.size === candidate.size)) {
          continue;
        }
        next.push(candidate);
      }

      setFileError(problems.join(" "));
      return next;
    });
  };

  const removeFile = (index) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;
    setSubmitting(true);
    setFileError("");
    try {
      const { created, failed } = await api.createCorrespondence(files);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";

      if (failed.length > 0) {
        toast.error(`${failed.length} file${failed.length > 1 ? "s" : ""} could not be processed: ${failed.map((f) => `${f.filename} (${f.error})`).join("; ")}`);
      }

      if (created.length === 1) {
        // A single submission — take them straight to it so they can watch
        // it process, instead of making them find it in the list below.
        navigate(`/correspondence/${created[0].id}`);
        return;
      }

      await load();
      if (created.length > 1) {
        toast.success(`${created.length} submissions received — we'll update their status as they're reviewed.`);
      }
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
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">My Submissions</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">Upload correspondence and track it through review and forwarding.</p>
      </div>

      <Card className="mb-8 p-6">
        <h2 className="font-bold text-ink-900 dark:text-white">Submit new correspondence</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">
          Attach one or more documents — each is tracked and reviewed as its own separate submission.
        </p>
        <form onSubmit={handleSubmit} className="mt-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            className="hidden"
            onChange={(e) => {
              // e.target.files is a live reference tied to the input element —
              // it must be snapshotted into a plain array before clearing the
              // input's value below, otherwise pickFiles's state update (which
              // React defers) can run after the live list has already been
              // emptied out by the reset, silently dropping every file picked.
              const selected = Array.from(e.target.files || []);
              e.target.value = "";
              pickFiles(selected);
            }}
          />

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              pickFiles(Array.from(e.dataTransfer.files || []));
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragActive ? "border-gold-500 bg-gold-500/5" : "border-slate-300 dark:border-white/15 hover:border-gold-400 hover:bg-slate-50 dark:hover:bg-white/5"
            }`}
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-500/10 text-gold-600">
              <UploadCloud size={22} />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink-900 dark:text-white">Click to upload or drag and drop</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-white/35">PDF, DOCX, or TXT &middot; Max 10 MB each &middot; Up to {MAX_FILES} files</p>
          </div>

          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((f, i) => (
                <li key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-gold-500/15 text-gold-600">
                      <FileText size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900 dark:text-white">{f.name}</p>
                      <p className="text-xs text-slate-400 dark:text-white/35">{(f.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="grid h-7 w-7 flex-none place-items-center rounded-full text-slate-400 dark:text-white/35 transition hover:bg-slate-200 hover:text-slate-700"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fileError && <p className="mt-3 text-sm font-medium text-red-600">{fileError}</p>}

          <Button type="submit" disabled={submitting || files.length === 0} className="mt-4">
            <SendHorizonal size={16} />
            {submitting
              ? "Submitting..."
              : files.length > 1
                ? `Submit ${files.length} files`
                : "Submit"}
          </Button>
        </form>
      </Card>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search subject, file..." />
        <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} placeholder="All statuses" options={STATUS_OPTIONS} />
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-white/10">
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
