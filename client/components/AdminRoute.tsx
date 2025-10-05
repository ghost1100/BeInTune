import { Navigate } from "react-router-dom";
import useAuth from "@/hooks/use-auth";

export default function AdminRoute({
  children,
}: {
  children: React.ReactElement;
}) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;

  return children;
}
