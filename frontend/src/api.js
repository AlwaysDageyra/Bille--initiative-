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
  routeCorrespondence: (id, department_id, note) =>
    request(`/correspondence/${id}/route`, { method: "POST", body: JSON.stringify({ department_id, note }) }),
  reanalyze: (id) => request(`/correspondence/${id}/reanalyze`, { method: "POST" }),
  updateStatus: (id, status, note) =>
    request(`/correspondence/${id}/status`, { method: "POST", body: JSON.stringify({ status, note }) }),
};
