import { cn } from "@/lib/utils";

/**
 * `<Skeleton />` — bloque animado placeholder.
 *
 * Reglas de la primitiva:
 * - `motion-safe:animate-pulse` respeta `prefers-reduced-motion` (WCAG 2.3.3).
 * - Por defecto es `aria-hidden` porque se espera dentro de un contenedor
 *   con `role="status"` / `aria-busy="true"` (ver `SkeletonGroup`). El
 *   contenedor es quien anuncia "cargando"; los bloques individuales no.
 * - Pasa `aria-hidden={false}` sólo si es el único skeleton visible y NO
 *   está envuelto en un grupo — en ese caso deberá tener también `role="status"`.
 */
function Skeleton({
  className,
  "aria-hidden": ariaHidden = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden={ariaHidden}
      className={cn("motion-safe:animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/**
 * `<SkeletonGroup />` — wrapper accesible para agrupar varios `<Skeleton />`.
 *
 * Anuncia "Cargando…" a lectores de pantalla vía `role="status"` +
 * `aria-busy="true"` + un texto `sr-only`. Los `<Skeleton />` hijos quedan
 * silenciados por `aria-hidden`.
 */
function SkeletonGroup({
  className,
  loadingLabel = "Cargando",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { loadingLabel?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={className}
      {...props}
    >
      <span className="sr-only">{loadingLabel}…</span>
      {children}
    </div>
  );
}

export { Skeleton, SkeletonGroup };
