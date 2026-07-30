import * as React from "react";
import { AlertTriangle, ClipboardCopy, MessageSquarePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_VERSION } from "@/constants/appVersion";

interface Props {
  error: Error | null;
  eventId: string | null;
  componentStack: string | null;
  timestamp: string | null;
  onReset: () => void;
  onReport: () => void;
  onCopyDetails: () => void;
}

/** UI presentacional del ErrorBoundary. Sin lógica de reporte. */
export function ErrorBoundaryFallback({
  error,
  eventId,
  componentStack,
  timestamp,
  onReset,
  onReport,
  onCopyDetails,
}: Props): React.JSX.Element {
  const route =
    typeof window !== "undefined" ? window.location.pathname + window.location.search : "";
  const openByDefault = Boolean(import.meta.env?.DEV);

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-6">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-6 space-y-4">
          <div className="text-center space-y-2">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-lg font-semibold">Algo salió mal</h2>
            <p className="text-sm text-muted-foreground">
              Ocurrió un error inesperado al cargar esta sección. Puedes intentar recargar
              o volver al inicio.
            </p>
          </div>

          <details open={openByDefault} className="rounded-md border bg-muted/50 text-xs">
            <summary className="cursor-pointer select-none px-3 py-2 font-medium">
              Detalles técnicos
            </summary>
            <div className="px-3 pb-3 space-y-2 font-mono">
              <div className="grid grid-cols-[110px,1fr] gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Versión</span>
                <span>{APP_VERSION}</span>
                <span className="text-muted-foreground">Timestamp</span>
                <span>{timestamp ?? "—"}</span>
                <span className="text-muted-foreground">Ruta</span>
                <span className="break-all">{route || "—"}</span>
                <span className="text-muted-foreground">Event ID</span>
                <span className="break-all">{eventId ?? "(pendiente)"}</span>
                <span className="text-muted-foreground">Nombre</span>
                <span>{error?.name ?? "—"}</span>
                <span className="text-muted-foreground">Mensaje</span>
                <span className="break-words whitespace-pre-wrap">
                  {error?.message ?? "—"}
                </span>
              </div>
              {error?.stack && (
                <div>
                  <div className="text-muted-foreground mb-1">Stack</div>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all bg-background/60 rounded p-2">
                    {error.stack}
                  </pre>
                </div>
              )}
              {componentStack && (
                <div>
                  <div className="text-muted-foreground mb-1">Component stack</div>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all bg-background/60 rounded p-2">
                    {componentStack}
                  </pre>
                </div>
              )}
            </div>
          </details>

          <div className="flex flex-wrap gap-2 justify-center">
            <Button onClick={onReset}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reintentar
            </Button>
            <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
              Ir al inicio
            </Button>
            <Button variant="secondary" onClick={onReport}>
              <MessageSquarePlus className="h-4 w-4 mr-1" /> Reportar
            </Button>
            <Button variant="ghost" onClick={onCopyDetails}>
              <ClipboardCopy className="h-4 w-4 mr-1" /> Copiar detalles
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
