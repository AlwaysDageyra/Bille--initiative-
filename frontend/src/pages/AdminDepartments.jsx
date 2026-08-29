import { useEffect, useState } from "react";
import { FolderPlus, Pencil, Save, X, Building2 } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Feedback";
import { Card, Button, EmptyState } from "../components/ui";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 dark:border-white/15 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15";

export default function AdminDepartments() {
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", sla_days: "" });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSlaDays, setEditSlaDays] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.listDepartments().then(setDepartments);
  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.adminCreateDepartment({ ...form, sla_days: form.sla_days || null });
      setForm({ name: "", description: "", sla_days: "" });
      load();
      toast.success(`Department "${form.name}" created.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (d) => {
    setEditingId(d.id);
    setEditName(d.name);
    setEditDescription(d.description || "");
    setEditSlaDays(d.sla_days || "");
  };

  const handleSaveEdit = async (id) => {
    setBusy(true);
    try {
      await api.adminUpdateDepartment(id, { name: editName, description: editDescription, sla_days: editSlaDays || null });
      setEditingId(null);
      load();
      toast.success("Department updated.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">Departments</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">Departments correspondence can be forwarded to.</p>
      </div>

      <Card className="mb-8 p-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-900 dark:text-white"><FolderPlus size={16} /> Create Department</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-ink-900 dark:text-white">
            Name
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} required />
          </label>
          <label className="text-sm font-medium text-ink-900 dark:text-white">
            Description
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={inputClass}
              placeholder="e.g. budget, payment, invoices, audit"
            />
          </label>
          <p className="text-xs text-slate-400 dark:text-white/35 sm:col-span-2">
            Keep this to a few short keywords, not full sentences — it's fed to the AI to help it recommend this department when a letter doesn't name one explicitly, and longer descriptions were found to reduce extraction accuracy.
          </p>
          <label className="text-sm font-medium text-ink-900 dark:text-white sm:col-span-2 sm:max-w-xs">
            Response target — SLA (days, optional)
            <input
              type="number"
              min="1"
              value={form.sla_days}
              onChange={(e) => setForm((f) => ({ ...f, sla_days: e.target.value }))}
              className={inputClass}
              placeholder="e.g. 3"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating}>Create Department</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/50">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">SLA</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 dark:border-white/5 last:border-0">
                  {editingId === d.id ? (
                    <>
                      <td className="px-5 py-3.5">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-white/15 px-2 py-1.5 text-sm" />
                      </td>
                      <td className="px-5 py-3.5">
                        <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-white/15 px-2 py-1.5 text-sm" />
                      </td>
                      <td className="px-5 py-3.5">
                        <input
                          type="number"
                          min="1"
                          placeholder="days"
                          value={editSlaDays}
                          onChange={(e) => setEditSlaDays(e.target.value)}
                          className="w-20 rounded-lg border border-slate-300 dark:border-white/15 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleSaveEdit(d.id)} disabled={busy} className="grid h-8 w-8 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50">
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
                      <td className="px-5 py-3.5 font-medium text-ink-900 dark:text-white">{d.name}</td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-white/65">{d.description || "—"}</td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-white/65">{d.sla_days ? `${d.sla_days} day${d.sla_days === 1 ? "" : "s"}` : "—"}</td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => startEdit(d)} className="inline-flex items-center gap-1 text-sm font-semibold text-gold-600 hover:text-gold-500">
                          <Pencil size={13} /> Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {departments.length === 0 && <EmptyState icon={Building2} title="No departments yet" />}
        </div>
      </Card>
    </div>
  );
}
