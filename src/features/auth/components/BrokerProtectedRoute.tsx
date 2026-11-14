/**
 * Guard del Portal de Brokers. Sólo permite el rol `broker`.
 */
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/lib/contexts/AuthContext";
import { RouteLoadingSkeleton } from "@/components/ui/RouteLoadingSkeleton";
import { ErrorState } from "@/components/shared/states/ErrorState";

export function BrokerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading, profileError, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) return <RouteLoadingSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (profileError) {
    return (
      <ErrorState
        title="No pudimos verificar tus permisos"
        description="Revisa tu conexión e intenta de nuevo."
        onRetry={() => void refreshProfile()}
      />
    );
  }
  if (role !== "broker") return <Navigate to="/" replace />;
  return <>{children}</>;
}
