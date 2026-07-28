import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function PortalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
