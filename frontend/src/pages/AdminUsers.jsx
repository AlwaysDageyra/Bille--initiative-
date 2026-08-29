import { useEffect, useState } from "react";
import { UserPlus, Pencil, Save, X, Users } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Feedback";
import { Card, Button, EmptyState } from "../components/ui";

const ROLE_OPTIONS = [
  { value: "submitter", label: "Submitter (NGO)" },
  { value: "coordinator", label: "Coordinator" },
  { value: "dept_manager", label: "Department Manager" },
  { value: "admin", label: "Admin" },
];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 dark:border-white/15 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15";

function RoleBadge({ role }) {
  const label = ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
  return <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-white/65">{label}</span>;
}

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ username: "", password: "", role: "submitter", department_id: "", email: "" });
  const [creating, setCreating] = useState(false);

  const load = () => {
    api.adminListUsers().then(setUsers);
    api.listDepartments().then(setDepartments);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.adminCreateUser({
        ...form,
        department_id: form.role === "dept_manager" ? Number(form.department_id) : null,
      });
      setForm({ username: "", password: "", role: "submitter", department_id: "", email: "" });
      load();
      toast.success(`User "${form.username}" created.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditRole(u.role);
    setEditDept(u.department_id || "");
    setEditEmail(u.email || "");
    setEditPassword("");
  };

  const handleSaveEdit = async (id) => {
    setBusy(true);
    try {
      const payload = {
        role: editRole,
        department_id: editRole === "dept_manager" ? Number(editDept) : null,
        email: editEmail,
      };
      if (editPassword) payload.password = editPassword;
      await api.adminUpdateUser(id, payload);
      setEditingId(null);
      load();
      toast.success("User updated.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">Create and manage staff accounts and their roles.</p>
      </div>

      <Card className="mb-8 p-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-900 dark:text-white"><UserPlus size={16} /> Create User</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-ink-900 dark:text-white">
            Username
            <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className={inputClass} required />
          </label>
          <label className="text-sm font-medium text-ink-900 dark:text-white">
            Email (optional)
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} placeholder="for email notifications" />
          </label>
          <label className="text-sm font-medium text-ink-900 dark:text-white">
            Password
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputClass} required />
          </label>
          <label className="text-sm font-medium text-ink-900 dark:text-white">
            Role
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={inputClass}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          {form.role === "dept_manager" ? (
            <label className="text-sm font-medium text-ink-900 dark:text-white">
              Department
              <select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))} className={inputClass} required>
                <option value="">-- select --</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          ) : <div />}
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={creating}>Create User</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/50">
                <th className="px-5 py-3">Username</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 dark:border-white/5 last:border-0">
                  {editingId === u.id ? (
                    <>
                      <td className="px-5 py-3.5 font-medium text-ink-900 dark:text-white">{u.username}</td>
                      <td className="px-5 py-3.5">
                        <input
                          type="email"
                          placeholder="email (optional)"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-40 rounded-lg border border-slate-300 dark:border-white/15 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="rounded-lg border border-slate-300 dark:border-white/15 px-2 py-1.5 text-sm">
                          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3.5">
                        {editRole === "dept_manager" ? (
                          <select value={editDept} onChange={(e) => setEditDept(e.target.value)} className="rounded-lg border border-slate-300 dark:border-white/15 px-2 py-1.5 text-sm">
                            <option value="">-- select --</option>
                            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="New password (optional)"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="w-40 rounded-lg border border-slate-300 dark:border-white/15 px-2 py-1.5 text-xs"
                          />
                          <button onClick={() => handleSaveEdit(u.id)} disabled={busy} className="grid h-8 w-8 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50">
                            <Save size={15} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 dark:text-white/35 hover:bg-slate-100 dark:hover:bg-white/10">
                            <X size={15} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3.5 font-medium text-ink-900 dark:text-white">{u.username}</td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-white/65">{u.email || "—"}</td>
                      <td className="px-5 py-3.5"><RoleBadge role={u.role} /></td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-white/65">{u.department_name || "—"}</td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => startEdit(u)} className="inline-flex items-center gap-1 text-sm font-semibold text-gold-600 hover:text-gold-500">
                          <Pencil size={13} /> Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <EmptyState icon={Users} title="No users yet" />}
        </div>
      </Card>
    </div>
  );
}
