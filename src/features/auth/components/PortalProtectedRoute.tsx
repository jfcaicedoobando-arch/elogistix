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
    // O3.13 (FIX-R3): conservar la audiencia — un cliente con deep-link al
    // portal debe ver el login contextual ("Portal de clientes"), no el
    // login genérico (era el camino real del guard, shots/34).
    return <Navigate to="/login?audiencia=cliente" replace state={{ from: location }} />;
  }

  if (role !== "cliente") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
