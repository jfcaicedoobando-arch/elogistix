/**
 * Guard del Portal del Agente de Carga. Sólo permite el rol `agente_carga`.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { RouteLoadingSkeleton } from "@/components/ui/RouteLoadingSkeleton";

export function AgenteProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <RouteLoadingSkeleton />;
  }

  // O3.13 (FIX-R3): audiencia=agente para el login contextual + deep-link
  // conservado (mismo patrón B-104 que PortalProtectedRoute).
  if (!user) return <Navigate to="/login?audiencia=agente" replace state={{ from: location }} />;
  if (role !== "agente_carga") return <Navigate to="/" replace />;

  return <>{children}</>;
}
