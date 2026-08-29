import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart3, Clock, ThumbsUp, AlertTriangle, Inbox } from "lucide-react";
import { api } from "../api";
import { useTheme } from "../context/ThemeContext";
import { Card, StatCard, EmptyState } from "../components/ui";
import { isOverdue } from "../utils/priority";

const STATUS_COLORS = {
  submitted: "#94a3b8",
  ai_analyzed: "#ef4444",
  pending_coordinator_review: "#f59e0b",
  routed: "#3b82f6",
  in_progress: "#8b5cf6",
  closed: "#10b981",
};
const STATUS_LABELS = {
  submitted: "Submitted",
  ai_analyzed: "AI Failed",
  pending_coordinator_review: "Pending Review",
  routed: "Forwarded",
  in_progress: "In Progress",
  closed: "Closed",
};
const URGENCY_COLORS = { High: "#ef4444", Medium: "#f59e0b", Low: "#10b981" };
const DEPT_BAR_COLOR = "#0ea968";

function ChartCard({ title, children, height = 280 }) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-bold text-ink-900 dark:text-white">{title}</h3>
      <div style={{ width: "100%", height }}>{children}</div>
    </Card>
  );
}

export default function Analytics() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const gridStroke = isDark ? "#33322a" : "#e2e8f0";
  const tickFill = isDark ? "#a3a196" : "#64748b";
  const cursorFill = isDark ? "rgba(255,255,255,0.04)" : "#f8fafc";
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.listCorrespondence().then(setItems);
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const routedItems = items.filter((c) => c.final_department_id);
    const agreementEligible = routedItems.length;
    const agreementCount = routedItems.filter((c) => c.recommended_department_id === c.final_department_id).length;
    const agreementRate = agreementEligible ? Math.round((agreementCount / agreementEligible) * 100) : null;

    const turnaroundHours = items
      .filter((c) => c.routed_at)
      .map((c) => (new Date(c.routed_at) - new Date(c.created_at)) / 3600000);
    const avgTurnaround = turnaroundHours.length
      ? turnaroundHours.reduce((a, b) => a + b, 0) / turnaroundHours.length
      : null;

    const overdueCount = items.filter((c) => isOverdue(c.deadline, c.status)).length;

    const byStatus = Object.keys(STATUS_LABELS).map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: items.filter((c) => c.status === status).length,
    })).filter((s) => s.count > 0);

    const byUrgency = ["High", "Medium", "Low"].map((urgency) => ({
      urgency,
      count: items.filter((c) => c.urgency === urgency).length,
    }));

    const deptCounts = {};
    items.forEach((c) => {
      const name = c.final_department_name || c.recommended_department_name || "Unassigned";
      deptCounts[name] = (deptCounts[name] || 0) + 1;
    });
    const byDept = Object.entries(deptCounts).map(([name, count]) => ({ name, count }));

    return { total, agreementRate, avgTurnaround, overdueCount, byStatus, byUrgency, byDept };
  }, [items]);

  if (items.length === 0) {
    return (
      <div>
        <div className="mb-7">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/50">Volume, forwarding accuracy, and turnaround across all correspondence.</p>
        </div>
        <Card><EmptyState icon={Inbox} title="No data yet" subtitle="Analytics will appear once correspondence has been submitted." /></Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">Volume, forwarding accuracy, and turnaround across all correspondence.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={BarChart3} label="Total correspondence" value={stats.total} accent="gold" delay={0} />
        <StatCard
          icon={Clock}
          label="Avg. time to forward"
          value={stats.avgTurnaround === null ? "—" : stats.avgTurnaround < 1 ? "<1h" : `${stats.avgTurnaround.toFixed(1)}h`}
          accent="blue"
          delay={0.05}
        />
        <StatCard
          icon={ThumbsUp}
          label="AI forwarding agreement"
          value={stats.agreementRate === null ? "—" : `${stats.agreementRate}%`}
          accent="purple"
          delay={0.1}
        />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdueCount} accent="red" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Correspondence by Department">
          <ResponsiveContainer>
            <BarChart data={stats.byDept} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: tickFill }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: tickFill }} />
              <Tooltip cursor={{ fill: cursorFill }} />
              <Bar dataKey="count" fill={DEPT_BAR_COLOR} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Breakdown">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={stats.byStatus} dataKey="count" nameKey="label" innerRadius={60} outerRadius={95} paddingAngle={2}>
                {stats.byStatus.map((s) => (
                  <Cell key={s.status} fill={STATUS_COLORS[s.status]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Urgency Distribution" height={240}>
          <ResponsiveContainer>
            <BarChart data={stats.byUrgency} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: tickFill }} />
              <YAxis type="category" dataKey="urgency" tick={{ fontSize: 12, fill: tickFill }} width={60} />
              <Tooltip cursor={{ fill: cursorFill }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {stats.byUrgency.map((u) => (
                  <Cell key={u.urgency} fill={URGENCY_COLORS[u.urgency]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
