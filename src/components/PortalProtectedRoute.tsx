import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function PortalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  if (role !== "cliente") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
