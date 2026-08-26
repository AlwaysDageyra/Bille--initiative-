import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, LogOut, Sparkles, Inbox, ClipboardCheck, Building2,
  BarChart3, Settings, Users, ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { PageTransition } from "./ui";

const ROLE_META = {
  submitter: { label: "Submitter (NGO)", icon: Inbox },
  coordinator: { label: "Coordinator", icon: ClipboardCheck },
  dept_manager: { label: "Department Manager", icon: Building2 },
  admin: { label: "Admin", icon: ShieldCheck },
};

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [newRoutedCount, setNewRoutedCount] = useState(0);

  useEffect(() => {
    if (user?.role !== "coordinator" && user?.role !== "dept_manager") return;
    api
      .listCorrespondence()
      .then((items) => {
        setPendingCount(items.filter((c) => c.status === "pending_coordinator_review").length);
        setNewRoutedCount(items.filter((c) => c.status === "routed").length);
      })
      .catch(() => {});
  }, [user?.role, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const meta = user ? ROLE_META[user.role] : null;
  const initials = user?.username?.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f4f6fb]">
      <aside className="sidebar-scroll fixed inset-y-0 hidden w-64 flex-col overflow-y-auto bg-gradient-to-b from-ink-950 to-ink-900 text-slate-200 md:flex print:hidden">
        <div className="px-6 pb-6 pt-7">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 shadow-lg shadow-gold-500/20">
              <Sparkles size={18} strokeWidth={2.5} />
            </span>
            <div className="leading-tight">
              <p className="font-extrabold tracking-tight text-white">GovFlow AI</p>
              <p className="text-[11px] text-slate-400">Correspondence &amp; Action</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {user?.role === "admin" ? (
            <>
              <NavLink to="/admin/users" active={location.pathname === "/admin/users"}>
                <Users size={17} />
                Users
              </NavLink>
              <NavLink to="/admin/departments" active={location.pathname === "/admin/departments"}>
                <Building2 size={17} />
                Departments
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/dashboard" active={location.pathname === "/dashboard"}>
                <LayoutDashboard size={17} />
                <span className="flex-1">Dashboard</span>
                {user?.role === "dept_manager" && newRoutedCount > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-ink-950">
                    {newRoutedCount}
                  </span>
                )}
              </NavLink>
              {user?.role === "coordinator" && (
                <NavLink to="/queue" active={location.pathname === "/queue"}>
                  <ClipboardCheck size={17} />
                  <span className="flex-1">Approval Queue</span>
                  {pendingCount > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-ink-950">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              )}
              {user?.role === "coordinator" && (
                <NavLink to="/analytics" active={location.pathname === "/analytics"}>
                  <BarChart3 size={17} />
                  Analytics
                </NavLink>
              )}
              {user?.role === "submitter" && (
                <NavLink to="/submissions" active={location.pathname === "/submissions"}>
                  <Inbox size={17} />
                  My Submissions
                </NavLink>
              )}
            </>
          )}
          <NavLink to="/account" active={location.pathname === "/account"}>
            <Settings size={17} />
            Account
          </NavLink>
        </nav>

        {user && (
          <div className="mt-auto p-3">
            <div className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-gold-500/90 text-xs font-bold text-ink-950">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{user.username}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {meta?.label}
                    {user.department_name ? ` · ${user.department_name}` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut size={13} /> Log out
              </button>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 md:pl-64 print:pl-0">
        <header className="flex items-center justify-between bg-ink-950 px-4 py-3 text-white md:hidden print:hidden">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold">
            <Sparkles size={16} className="text-gold-400" /> GovFlow AI
          </Link>
          {user && (
            <button onClick={handleLogout} aria-label="Log out">
              <LogOut size={18} />
            </button>
          )}
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">
          <AnimatePresence mode="wait">
            <PageTransition transitionKey={location.pathname}>{children}</PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
