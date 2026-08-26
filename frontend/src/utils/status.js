// Mirrors PRE_ROUTING_STATUSES in backend/app/routes/correspondence.py —
// a submitter may only edit/delete their own letter before it's routed.
export const PRE_ROUTING_STATUSES = ["submitted", "ai_analyzed", "pending_coordinator_review"];
