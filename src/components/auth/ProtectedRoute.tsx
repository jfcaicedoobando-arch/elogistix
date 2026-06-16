import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import type { AppRole } from "@/types/appRole";
import { anyRoleSatisfies } from "@/lib/auth/roleHierarchy";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, effectiveRole, organization, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
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

  // Onboarding inicial: si la organización del usuario no ha completado los
  // datos básicos (RFC, dirección, moneda), forzar al admin a completarlos.
  if (
    organization &&
    organization.onboarding_completado === false &&
    role !== "cliente" &&
    !isSuperAdmin &&
    !location.pathname.startsWith("/onboarding")
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  if (allowedRoles && effectiveRole && !anyRoleSatisfies(allowedRoles, effectiveRole as AppRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
