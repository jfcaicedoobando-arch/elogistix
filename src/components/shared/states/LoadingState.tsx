/**
 * `<LoadingState />` — placeholder de carga estándar.
 *
 * Reemplaza los `Loader2` centrados a mano que hoy viven en 15+ páginas.
 *
 * P-06 (auditoría E2E 2026-07-29): el spinner nunca expiraba, así que cuando la
 * API fallaba o tardaba, la pantalla se quedaba en "Cargando…" para siempre.
 * Ahora, pasado `timeoutMs` (15s por defecto) o si el consumidor pasa `error`,
 * mostramos un estado accionable con botón "Reintentar".
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  /** Texto opcional bajo el spinner. Default: "Cargando…". */
  label?: string;
  className?: string;
  /** Altura mínima del contenedor. Default: `min-h-[240px]`. */
  minHeight?: string;
  /** Milisegundos antes de considerar la carga fallida. `0` desactiva el timeout. */
  timeoutMs?: number;
  /** Si es `true`, muestra el estado de error de inmediato. */
  error?: boolean;
  /** Callback del botón "Reintentar". */
  onRetry?: () => void;
  /** Mensaje del estado de error. */
  errorLabel?: string;
}

export function LoadingState({
  label = "Cargando…",
  className,
  minHeight = "min-h-[240px]",
  timeoutMs = 15_000,
  error = false,
  onRetry,
  errorLabel = "No se pudo cargar la información.",
}: LoadingStateProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!timeoutMs) return;
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  if (error || timedOut) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center gap-3 text-muted-foreground",
          minHeight,
          className,
        )}
      >
        <p className="text-sm">{errorLabel}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setTimedOut(false);
            onRetry?.();
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        minHeight,
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}
