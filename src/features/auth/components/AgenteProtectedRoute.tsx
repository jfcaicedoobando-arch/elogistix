/**
 * Guard del Portal del Agente de Carga. Sólo permite el rol `agente_carga`.
 */
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";

export function AgenteProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role !== "agente_carga") return <Navigate to="/" replace />;

  return <>{children}</>;
}
