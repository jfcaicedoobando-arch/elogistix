/**
 * Ruta raíz "/" — pública. Si el visitante NO tiene sesión muestra la landing
 * pública de Libre Carga; si sí la tiene, lo redirige al dashboard interno.
 * (Los roles cliente / super_admin son re-redirigidos por ProtectedRoute desde
 * `/inicio` hacia `/portal` o `/admin` respectivamente.)
 */
import { Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { PageSkeleton } from "@/components/shared/skeletons/PageSkeleton";

const Landing = lazy(() => import("./Landing"));

export default function HomeRoute() {
  const { user, effectiveRole, loading, profileError } = useAuth();

  // UI-07: skeleton en lugar de spinner de página.
  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <PageSkeleton className="w-full max-w-3xl" />
      </div>
    );
  }

  // VT-03: sólo redirigimos cuando el perfil REALMENTE resolvió. Si falló por
  // red, mandar a `/sin-acceso` dejaba al usuario sin ninguna pantalla útil
  // (lockout total); en ese caso mostramos la landing pública.
  if (user && !profileError) {
    // RG1: sin rol efectivo, `/inicio` nos rebotaría de vuelta aquí (bucle).
    return <Navigate to={effectiveRole ? "/inicio" : "/sin-acceso"} replace />;
  }


  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center p-6">
          <PageSkeleton className="w-full max-w-3xl" />
        </div>
      }
    >
      <Landing />
    </Suspense>
  );
}
