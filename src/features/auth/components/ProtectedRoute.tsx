import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import type { AppRole } from "@/types/appRole";
import { anyRoleSatisfies } from "@/lib/auth/roleHierarchy";
import { resolveProtectedRouteRedirect } from "@/features/auth/utils/resolveProtectedRouteRedirect";
import { notifyWarning } from "@/lib/ui/appFeedback";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, effectiveRole, organization, loading } = useAuth();
  const location = useLocation();

  const sinAcceso =
    !loading &&
    Boolean(user) &&
    Boolean(allowedRoles) &&
    Boolean(effectiveRole) &&
    !anyRoleSatisfies(allowedRoles as AppRole[], effectiveRole as AppRole);

  // Aviso al usuario por qué fue redirigido, en lugar de un silencio total.
  useEffect(() => {
    if (sinAcceso) {
      notifyWarning(undefined, { title: "No tienes acceso a esa sección" });
    }
  }, [sinAcceso, location.pathname]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // P-07: conservar el deep-link solicitado para volver tras el login.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const redirectTo = resolveProtectedRouteRedirect({
    role,
    organization,
    pathname: location.pathname,
  });
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  if (sinAcceso) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
