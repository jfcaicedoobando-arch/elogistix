import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import type { AppRole } from "@/types/appRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, effectiveRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Cliente accessing regular app routes → redirect to /portal
  if (role === "cliente" && !location.pathname.startsWith("/portal")) {
    return <Navigate to="/portal" replace />;
  }

  // Super admin accessing regular app routes → redirect to /admin
  const isSuperAdmin = role === "super_admin";
  if (isSuperAdmin && !location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  if (allowedRoles && effectiveRole && !allowedRoles.includes(effectiveRole as AppRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
