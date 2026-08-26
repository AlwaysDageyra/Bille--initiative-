import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Inbox, Clock, Send, CheckCircle2, ArrowRight, UploadCloud, Sparkles,
  ScanSearch, ClipboardCheck, FileText, Route,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Card, StatCard, EmptyState } from "../components/ui";
import { Avatar } from "../components/TableControls";
import StatusBadge from "../components/StatusBadge";

const STEPS = [
  { icon: UploadCloud, title: "You submit", text: "Upload a letter, memo, or notice as a PDF, DOCX, or TXT file." },
  { icon: ScanSearch, title: "AI analyzes", text: "Ollama extracts the subject, sender, deadline, and recommends a department." },
  { icon: ClipboardCheck, title: "Coordinator reviews", text: "A coordinator confirms or corrects the AI's recommendation." },
  { icon: Route, title: "Routed for action", text: "The right department picks it up and works it to closure." },
];

export default function SubmitterDashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.listCorrespondence().then(setItems);
  }, []);

  const stats = {
    total: items.length,
    pending: items.filter((c) => c.status === "pending_coordinator_review").length,
    routed: items.filter((c) => ["routed", "in_progress"].includes(c.status)).length,
    closed: items.filter((c) => c.status === "closed").length,
  };

  const recent = items.slice(0, 5);

  return (
    <div>
      <Card className="relative mb-8 overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-ink-800 p-7 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-400">
              <Sparkles size={13} /> GovFlow AI
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Welcome back, {user.username}</h1>
            <p className="mt-1 max-w-md text-sm text-slate-400">
              Track every letter you've submitted and see exactly where it stands in the review process.
            </p>
          </div>
          <Link
            to="/submissions"
            className="inline-flex flex-none items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-5 py-3 text-sm font-semibold text-ink-950 shadow-md shadow-gold-500/25 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <UploadCloud size={16} /> Submit New Correspondence
          </Link>
        </div>
      </Card>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Inbox} label="Total submitted" value={stats.total} accent="gold" delay={0} />
        <StatCard icon={Clock} label="Pending review" value={stats.pending} accent="blue" delay={0.05} />
        <StatCard icon={Send} label="Routed" value={stats.routed} accent="purple" delay={0.1} />
        <StatCard icon={CheckCircle2} label="Closed" value={stats.closed} accent="emerald" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-ink-900">Recent Submissions</h2>
            <Link to="/submissions" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-600 hover:text-gold-500">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <Card className="overflow-hidden">
            <div className="divide-y divide-slate-100">
              {recent.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                  className="flex items-center gap-3.5 p-4"
                >
                  <Avatar name={item.subject} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{item.subject || <em className="font-normal text-slate-400">(pending analysis)</em>}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {item.source_filename && (
                        <span className="inline-flex items-center gap-1"><FileText size={11} /> {item.source_filename}</span>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                  <Link to={`/correspondence/${item.id}`} className="flex-none text-slate-400 transition hover:text-gold-600">
                    <ArrowRight size={16} />
                  </Link>
                </motion.div>
              ))}
            </div>
            {recent.length === 0 && (
              <EmptyState icon={Inbox} title="No submissions yet" subtitle="Submit your first letter to see it appear here." />
            )}
          </Card>
        </div>

        <div>
          <h2 className="mb-4 font-bold text-ink-900">How It Works</h2>
          <Card className="divide-y divide-slate-100">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-3.5 p-4">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-gold-500/10 text-gold-600">
                  <step.icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">{i + 1}. {step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.text}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
