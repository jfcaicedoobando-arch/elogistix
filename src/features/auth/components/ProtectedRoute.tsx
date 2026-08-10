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
  /**
   * R-12.2: los guards anidados viven DENTRO del layout. Un spinner de alto
   * completo empujaba el contenido y provocaba un parpadeo del sidebar al
   * resolverse la sesión; con `inline` el placeholder ocupa sólo el área de
   * contenido.
   */
  inline?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, inline = false }: ProtectedRouteProps) {
  const { user, role, effectiveRole, organization, loading } = useAuth();
  const location = useLocation();

  const sinAcceso =
    !loading &&
    Boolean(user) &&
    Boolean(allowedRoles) &&
    // A1 (fail-closed): sin rol resuelto NO se concede acceso.
    (!effectiveRole ||
      !anyRoleSatisfies(allowedRoles as AppRole[], effectiveRole as AppRole));

  // Aviso al usuario por qué fue redirigido, en lugar de un silencio total.
  useEffect(() => {
    if (sinAcceso) {
      notifyWarning(undefined, { title: "No tienes acceso a esa sección" });
    }
  }, [sinAcceso, location.pathname]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={
          inline
            ? "flex min-h-[50vh] items-center justify-center"
            : "flex h-dvh items-center justify-center"
        }
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Verificando permisos…</span>
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
    // RG1: antes íbamos a "/" y HomeRoute rebotaba a "/inicio" → bucle infinito.
    return <Navigate to="/sin-acceso" replace />;
  }

  return <>{children}</>;
}
