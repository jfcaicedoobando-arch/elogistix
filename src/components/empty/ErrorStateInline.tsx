import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Error state COMPACTO para vistas financieras: distingue "sin datos" de
 * "falló la carga" y ofrece un botón "Reintentar" cuando `onRetry` está
 * definido. Auditoría Profit Fase 1.
 */
interface Props {
  /** Título principal del error */
  title?: string;
  /** Mensaje detallado (por ejemplo `error.message`) */
  message: string;
  /** Handler opcional para reintentar la carga */
  onRetry?: () => void;
  /** Indica que la operación de reintento está en curso */
  retrying?: boolean;
  /** Clases extra */
  className?: string;
}

export function ErrorStateInline({
  title = "No pudimos cargar la información",
  message,
  onRetry,
  retrying = false,
  className,
}: Props) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center py-8 px-4",
        "border border-destructive/30 bg-destructive/5 rounded-md text-destructive",
        className,
      )}
    >
      <AlertTriangle className="h-8 w-8 opacity-80" strokeWidth={1.5} />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs opacity-80 max-w-md break-words">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
          className="gap-2"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", retrying && "animate-spin")} />
          {retrying ? "Reintentando…" : "Reintentar"}
        </Button>
      )}
    </div>
  );
}
