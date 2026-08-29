import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import SubmitterDashboard from "./pages/SubmitterDashboard";
import MySubmissions from "./pages/MySubmissions";
import CoordinatorDashboard from "./pages/CoordinatorDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import NewArrivals from "./pages/NewArrivals";
import ApprovalQueue from "./pages/ApprovalQueue";
import Analytics from "./pages/Analytics";
import Account from "./pages/Account";
import AdminUsers from "./pages/AdminUsers";
import AdminDepartments from "./pages/AdminDepartments";
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

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireSubmitter({ children }) {
  const { user } = useAuth();
  if (user.role !== "submitter") return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireDeptManager({ children }) {
  const { user } = useAuth();
  if (user.role !== "dept_manager") return <Navigate to="/dashboard" replace />;
  return children;
}

function RoleDashboard() {
  const { user } = useAuth();
  if (user.role === "submitter") return <SubmitterDashboard />;
  if (user.role === "coordinator") return <CoordinatorDashboard />;
  if (user.role === "dept_manager") return <ManagerDashboard />;
  if (user.role === "admin") return <Navigate to="/admin/users" replace />;
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
        path="/submissions"
        element={
          <RequireAuth>
            <RequireSubmitter>
              <MySubmissions />
            </RequireSubmitter>
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
        path="/arrivals"
        element={
          <RequireAuth>
            <RequireDeptManager>
              <NewArrivals />
            </RequireDeptManager>
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
        path="/admin/users"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminUsers />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/departments"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminDepartments />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <Account />
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
