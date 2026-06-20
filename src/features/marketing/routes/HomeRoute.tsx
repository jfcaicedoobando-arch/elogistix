/**
 * Ruta raíz "/" — pública. Si el visitante NO tiene sesión muestra la landing
 * pública de Libre Carga; si sí la tiene, lo redirige al dashboard interno.
 * (Los roles cliente / super_admin son re-redirigidos por ProtectedRoute desde
 * `/inicio` hacia `/portal` o `/admin` respectivamente.)
 */
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";

const Landing = lazy(() => import("./Landing"));

export default function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/inicio" replace />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <Landing />
    </Suspense>
  );
}
