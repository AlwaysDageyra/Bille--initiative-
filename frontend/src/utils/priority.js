export function parseDeadline(str) {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isOverdue(deadlineStr, status) {
  if (status === "closed") return false;
  const d = parseDeadline(deadlineStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

// A department's SLA is measured from when a letter was routed to it, not
// from its own stated deadline — an internal ops target, separate from
// whatever the sender asked for.
export function slaStatus(routedAt, slaDays) {
  if (!routedAt || !slaDays) return null;
  const routed = new Date(routedAt);
  if (Number.isNaN(routed.getTime())) return null;

  const target = new Date(routed);
  target.setDate(target.getDate() + slaDays);

  const msPerDay = 86400000;
  const daysLeft = Math.ceil((target - new Date()) / msPerDay);
  return { target, daysLeft, overdue: daysLeft < 0 };
}

const URGENCY_RANK = { High: 0, Medium: 1, Low: 2 };

export function sortByPriority(items) {
  return [...items].sort((a, b) => {
    const ua = URGENCY_RANK[a.urgency] ?? 3;
    const ub = URGENCY_RANK[b.urgency] ?? 3;
    if (ua !== ub) return ua - ub;

    const da = parseDeadline(a.deadline);
    const db = parseDeadline(b.deadline);
    if (da && db) return da - db;
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
}
