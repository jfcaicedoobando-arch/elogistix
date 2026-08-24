/**
 * Guard del Portal del Agente de Carga. Sólo permite el rol `agente_carga`.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { RouteLoadingSkeleton } from "@/components/ui/RouteLoadingSkeleton";

export function AgenteProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <RouteLoadingSkeleton />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role !== "agente_carga") return <Navigate to="/" replace />;

  return <>{children}</>;
}
