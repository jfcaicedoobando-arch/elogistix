/**
 * `<CargaGuard />` — R8/FIX 1: ninguna pantalla puede quedarse colgada.
 *
 * Variante de `AsyncBoundary` para pantallas que YA pintan su propio
 * placeholder (p. ej. `DataTable` con `isLoading`, KPIs con skeleton interno).
 * En lugar de sustituir el contenido mientras carga, lo deja pasar tal cual y
 * sólo toma el control cuando algo va mal:
 *
 *   isError            -> ErrorState con "Reintentar"
 *   isLoading + 20 s   -> ErrorState "está tardando más de lo normal"
 *   resto              -> children
 *
 * Así se añade la red de seguridad a una ruta existente sin rehacer su
 * maquetación ni duplicar skeletons.
 */
import type { ReactNode } from "react";
import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";

export interface CargaGuardProps {
  isLoading?: boolean;
  isError?: boolean;
  /** Reintento explícito (típicamente `refetch` de TanStack Query). */
  onRetry?: () => void;
  /** Milisegundos antes de considerar la carga colgada. `0` desactiva. */
  timeoutMs?: number;
  errorTitle?: string;
  errorDescription?: string;
  className?: string;
  children: ReactNode;
}

export function CargaGuard({
  isLoading = false,
  isError = false,
  onRetry,
  timeoutMs = 20_000,
  errorTitle,
  errorDescription,
  className,
  children,
}: CargaGuardProps) {
  return (
    <AsyncBoundary
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      timeoutMs={timeoutMs}
      errorTitle={errorTitle}
      errorDescription={errorDescription}
      className={className}
      skeleton={children}
    >
      {children}
    </AsyncBoundary>
  );
}
