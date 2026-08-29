import { useState } from "react";
import { KeyRound } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Feedback";
import { Card, Button } from "../components/ui";

export default function Account() {
  const { user } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation don't match.");
      return;
    }

    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/50">Signed in as <strong>{user.username}</strong>.</p>
      </div>

      <Card className="max-w-md p-6">
        <h2 className="flex items-center gap-2 font-bold text-ink-900 dark:text-white">
          <KeyRound size={16} /> Change Password
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-ink-900 dark:text-white">
            Current Password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-white/15 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
              required
            />
          </label>
          <label className="block text-sm font-medium text-ink-900 dark:text-white">
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-white/15 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
              required
            />
          </label>
          <label className="block text-sm font-medium text-ink-900 dark:text-white">
            Confirm New Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-white/15 px-3.5 py-2.5 text-sm outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
              required
            />
          </label>
          <Button type="submit" disabled={busy}>Update Password</Button>
        </form>
      </Card>
    </div>
  );
}
