const API_BASE = "http://localhost:5000/api";

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: isFormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });

  let body = null;
  const text = await res.text();
  if (text) body = JSON.parse(text);

  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export const fileUrl = (id) => `${API_BASE}/correspondence/${id}/file`;

export const api = {
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),

  listDepartments: () => request("/departments"),

  listCorrespondence: () => request("/correspondence"),
  getCorrespondence: (id) => request(`/correspondence/${id}`),
  createCorrespondence: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request("/correspondence", { method: "POST", body: formData });
  },
  replaceCorrespondence: (id, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/correspondence/${id}`, { method: "PUT", body: formData });
  },
  deleteCorrespondence: (id) => request(`/correspondence/${id}`, { method: "DELETE" }),
  routeCorrespondence: (id, department_id, note) =>
    request(`/correspondence/${id}/route`, { method: "POST", body: JSON.stringify({ department_id, note }) }),
  reanalyze: (id) => request(`/correspondence/${id}/reanalyze`, { method: "POST" }),
  updateStatus: (id, status, note) =>
    request(`/correspondence/${id}/status`, { method: "POST", body: JSON.stringify({ status, note }) }),
  updateFields: (id, fields) =>
    request(`/correspondence/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),
  bounceBack: (id, note) =>
    request(`/correspondence/${id}/bounce`, { method: "POST", body: JSON.stringify({ note }) }),
  addFollowup: (id, note) =>
    request(`/correspondence/${id}/followup`, { method: "POST", body: JSON.stringify({ note }) }),

  changePassword: (current_password, new_password) =>
    request("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) }),

  adminListUsers: () => request("/admin/users"),
  adminCreateUser: (payload) => request("/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateUser: (id, payload) => request(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminCreateDepartment: (payload) => request("/admin/departments", { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateDepartment: (id, payload) => request(`/admin/departments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
