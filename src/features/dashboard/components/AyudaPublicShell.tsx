import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { Skeleton } from "@/components/ui/skeleton";

const Ayuda = lazy(() => import("@/features/dashboard/routes/Ayuda"));

/**
 * VT-10 — Envoltorio público del centro de ayuda (`/ayuda`).
 *
 * El FAQ se enlaza desde contextos anónimos (login, portal), por lo que la ruta
 * es pública. Reutiliza el mismo componente `Ayuda` con una cabecera mínima
 * (mismo patrón que las páginas legales).
 */
export function AyudaPublicShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Libre Carga">
            <BrandLockup variant="horizontal" size="sm" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-body text-muted-foreground hover:text-foreground"
          >
            <LogIn className="h-4 w-4" /> Iniciar sesión
          </Link>
        </div>
      </header>
      <Suspense fallback={<Skeleton className="mx-auto mt-8 h-64 w-[90%] max-w-6xl" />}>
        <Ayuda />
      </Suspense>
    </div>
  );
}
