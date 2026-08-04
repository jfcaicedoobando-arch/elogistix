/**
 * `<AsyncBoundary />` — P1-1: ningún esqueleto puede quedarse colgado.
 *
 * Decide qué pintar a partir del estado de una (o varias) `useQuery`:
 *
 *   isError            -> ErrorState con "Reintentar"
 *   isLoading + expiró -> ErrorState "está tardando más de lo normal"
 *   isLoading          -> el `skeleton` que reciba el consumidor
 *   resto              -> children
 *
 * Complementa a ADR-001: `DataTable` ya resuelve el caso "lista", este
 * componente cubre KPIs, formularios y pantallas de detalle.
 */
import type { ReactNode } from "react";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { useCargaExpirada } from "@/hooks/shared/useCargaExpirada";

export interface AsyncBoundaryProps {
  isLoading?: boolean;
  isError?: boolean;
  /** Reintento explícito (típicamente `refetch` de TanStack Query). */
  onRetry?: () => void;
  /** Placeholder mientras carga. */
  skeleton?: ReactNode;
  /** Milisegundos antes de considerar la carga colgada. `0` desactiva. */
  timeoutMs?: number;
  errorTitle?: string;
  errorDescription?: string;
  className?: string;
  children: ReactNode;
}

const TIMEOUT_TITULO = "Está tardando más de lo normal";
const TIMEOUT_DESC =
  "La información no terminó de cargar. Reintenta o recarga la página.";

export function AsyncBoundary({
  isLoading = false,
  isError = false,
  onRetry,
  skeleton = null,
  timeoutMs = 20_000,
  errorTitle,
  errorDescription,
  className,
  children,
}: AsyncBoundaryProps) {
  const conTimeout = timeoutMs > 0;
  const expirada = useCargaExpirada(isLoading && conTimeout, conTimeout ? timeoutMs : 20_000);


  if (isError) {
    return (
      <ErrorState
        title={errorTitle}
        description={errorDescription}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  if (isLoading && timeoutMs > 0 && expirada) {
    return (
      <ErrorState
        title={TIMEOUT_TITULO}
        description={TIMEOUT_DESC}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  if (isLoading) return <>{skeleton}</>;

  return <>{children}</>;
}
