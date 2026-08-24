import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { RouteLoadingSkeleton } from "@/components/ui/RouteLoadingSkeleton";

export function PortalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <RouteLoadingSkeleton />;
  }

  if (!user) {
    // B-104: conservar el deep-link pedido para volver a él tras el login.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role !== "cliente") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
