/**
 * Guard del Portal del Agente de Carga. Sólo permite el rol `agente_carga`.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { RouteLoadingSkeleton } from "@/components/ui/RouteLoadingSkeleton";
import { ErrorState } from "@/components/shared/states/ErrorState";

export function AgenteProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading, profileError, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    return <RouteLoadingSkeleton />;
  }

  // O3.13 (FIX-R3): audiencia=agente para el login contextual + deep-link
  // conservado (mismo patrón B-104 que PortalProtectedRoute).
  if (!user) return <Navigate to="/login?audiencia=agente" replace state={{ from: location }} />;

  // P1 auditoría v13.824.3: si la consulta de permisos falla, antes se caía a
  // `role === null` y se expulsaba al inicio (o se veía "Verificando
  // permisos…" hasta recargar). Ahora se ofrece reintentar de forma explícita.
  if (profileError) {
    return (
      <ErrorState
        title="No pudimos verificar tus permisos"
        description="Revisa tu conexión e intenta de nuevo."
        onRetry={() => void refreshProfile()}
      />
    );
  }

  if (role !== "agente_carga") return <Navigate to="/" replace />;

  return <>{children}</>;
}
