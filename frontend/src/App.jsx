import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import SubmitterDashboard from "./pages/SubmitterDashboard";
import CoordinatorDashboard from "./pages/CoordinatorDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import ApprovalQueue from "./pages/ApprovalQueue";
import Analytics from "./pages/Analytics";
import CorrespondenceDetail from "./pages/CorrespondenceDetail";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function RequireCoordinator({ children }) {
  const { user } = useAuth();
  if (user.role !== "coordinator") return <Navigate to="/dashboard" replace />;
  return children;
}

function RoleDashboard() {
  const { user } = useAuth();
  if (user.role === "submitter") return <SubmitterDashboard />;
  if (user.role === "coordinator") return <CoordinatorDashboard />;
  if (user.role === "dept_manager") return <ManagerDashboard />;
  return <p>Unknown role.</p>;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner className="min-h-screen" />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <RoleDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/queue"
        element={
          <RequireAuth>
            <RequireCoordinator>
              <ApprovalQueue />
            </RequireCoordinator>
          </RequireAuth>
        }
      />
      <Route
        path="/analytics"
        element={
          <RequireAuth>
            <RequireCoordinator>
              <Analytics />
            </RequireCoordinator>
          </RequireAuth>
        }
      />
      <Route
        path="/correspondence/:id"
        element={
          <RequireAuth>
            <CorrespondenceDetail />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}
