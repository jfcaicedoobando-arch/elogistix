/**
 * `<LegalShell />` — marco visual común para las páginas legales públicas
 * (privacidad, términos, seguridad): header con marca + volver, y contenedor
 * de contenido con el mismo ancho y tipografía en las tres páginas.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { ROUTES } from "@/constants/routes";

export interface LegalShellProps {
  /** Etiqueta corta sobre el título (por defecto "Legal"). */
  eyebrow?: string;
  title: string;
  /** Fecha de última actualización, ya formateada. Se omite si no aplica. */
  updatedAt?: string;
  /** Ruta a la que apunta el logo y "Volver" (por defecto landing). */
  backTo?: string;
  children: ReactNode;
}

export function LegalShell({
  eyebrow = "Legal",
  title,
  updatedAt,
  backTo = ROUTES.LANDING,
  children,
}: LegalShellProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to={backTo} aria-label="Libre Carga"><BrandLockup variant="horizontal" size="sm" /></Link>
          <Link to={backTo} className="inline-flex items-center gap-1 text-body text-muted-foreground hover:text-foreground min-h-11">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {/* O3.5: la micro-etiqueta en mayúsculas usa el token canónico
            text-overline; recomponerla a mano está prohibido y cuenta
            como deuda en el ratchet de O3.5. */}
        <p className="mb-2 text-overline">{eyebrow}</p>
        <h1 className="text-display">{title}</h1>
        {updatedAt ? <p className="mt-2 text-body text-muted-foreground">Última actualización: {updatedAt}</p> : null}
        {children}
      </main>
    </div>
  );
}
