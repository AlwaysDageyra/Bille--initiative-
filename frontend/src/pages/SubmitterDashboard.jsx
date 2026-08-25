import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Inbox, Clock, Send, CheckCircle2, UploadCloud, FileText, X, SendHorizonal } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Feedback";
import StatusBadge, { STATUS_OPTIONS } from "../components/StatusBadge";
import { Card, Button, EmptyState, StatCard } from "../components/ui";
import { SearchInput, Select, Pagination, usePagedResult } from "../components/TableControls";

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

export default function SubmitterDashboard() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const inputRef = useRef(null);

  const load = () => api.listCorrespondence().then(setItems);

  useEffect(() => {
    load();
  }, []);

  const pickFile = (candidate) => {
    if (!candidate) return;
    const validationError = validateFile(candidate);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setError("");
    setFile(candidate);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError("");
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

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3">Recommended Dept</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Submitted</th>
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
                  <td className="px-5 py-3.5 font-medium text-ink-900">{c.subject || <em className="font-normal text-slate-400">(pending analysis)</em>}</td>
                  <td className="px-5 py-3.5 text-slate-500">{c.source_filename || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-600">{c.recommended_department_name || "—"}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3.5 text-slate-500">{new Date(c.created_at).toLocaleString()}</td>
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
              title={items.length === 0 ? "No submissions yet" : "No matches"}
              subtitle={items.length === 0 ? "Upload a letter or memo above to get started." : "Try a different search or filter."}
            />
          )}
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
        </div>
      </Card>
    </div>
  );
}
