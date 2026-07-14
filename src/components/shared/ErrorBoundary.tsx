import React from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCopy, MessageSquarePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logClientError } from "@/services/observability";
import { logger } from "@/lib/observability/logger";
import {
  isDynamicImportError,
  tryReloadForChunkError,
} from "@/lib/errors/dynamicImportError";
import { APP_VERSION } from "@/constants/appVersion";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
  componentStack: string | null;
  timestamp: string | null;
}

/**
 * ErrorBoundary con reporte directo a Sentry (sin fallback a mailto).
 * Muestra un panel de detalle con toda la info útil para depurar.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      eventId: null,
      componentStack: null,
      timestamp: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, eventId: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("ErrorBoundary", error, { componentStack: errorInfo.componentStack });

    if (isDynamicImportError(error)) {
      tryReloadForChunkError();
      return;
    }

    const timestamp = new Date().toISOString();
    let eventId: string | null = null;
    Sentry.withScope((scope) => {
      scope.setTag("source", "react-error-boundary");
      if (typeof window !== "undefined") {
        scope.setTag("crashed_route", window.location.pathname || "/");
      }
      scope.setTag("app_version", APP_VERSION);
      if (errorInfo.componentStack) {
        scope.setContext("react", { componentStack: errorInfo.componentStack });
      }
      eventId = Sentry.captureException(error);
    });

    this.setState({
      eventId,
      componentStack: errorInfo.componentStack ?? null,
      timestamp,
    });

    logClientError({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    if (isDynamicImportError(this.state.error) && tryReloadForChunkError()) {
      return;
    }
    this.setState({
      hasError: false,
      error: null,
      eventId: null,
      componentStack: null,
      timestamp: null,
    });
  };

  private ensureEventId(): string | null {
    if (this.state.eventId) return this.state.eventId;
    // Último recurso: capturar mensaje para obtener un eventId.
    try {
      const id = Sentry.captureMessage(
        `Manual crash report – ${this.state.error?.message ?? "sin error"}`,
        "error",
      );
      if (id) this.setState({ eventId: id });
      return id ?? null;
    } catch {
      return null;
    }
  }

  handleReportFeedback = async () => {
    const eventId = this.ensureEventId() ?? undefined;
    // 1) Widget de feedback de Sentry.
    try {
      const feedback = Sentry.getFeedback?.();
      if (feedback) {
        const form = await feedback.createForm();
        form.appendToDom();
        form.open();
        return;
      }
    } catch (err) {
      logger.warn("ErrorBoundary.feedback.widgetFailed", { err: String(err) });
    }
    // 2) Diálogo clásico de Sentry.
    try {
      if (eventId && typeof Sentry.showReportDialog === "function") {
        Sentry.showReportDialog({ eventId });
        return;
      }
    } catch (err) {
      logger.warn("ErrorBoundary.feedback.dialogFailed", { err: String(err) });
    }
    // 3) Fallback: toast con eventId para que el usuario lo comparta.
    if (eventId) {
      toast.error("No se pudo abrir el formulario de reporte", {
        description: `Comparte este ID con soporte: ${eventId}`,
      });
    } else {
      toast.error("No se pudo enviar el reporte a Sentry");
    }
  };

  private buildDetailsText(): string {
    const { error, eventId, componentStack, timestamp } = this.state;
    return [
      `Versión: ${APP_VERSION}`,
      `Timestamp: ${timestamp ?? ""}`,
      `Ruta: ${typeof window !== "undefined" ? window.location.pathname + window.location.search : ""}`,
      `Event ID: ${eventId ?? "(sin ID)"}`,
      `Nombre: ${error?.name ?? ""}`,
      `Mensaje: ${error?.message ?? ""}`,
      "",
      "Stack:",
      error?.stack ?? "(sin stack)",
      "",
      "Component stack:",
      componentStack ?? "(sin component stack)",
    ].join("\n");
  }

  handleCopyDetails = async () => {
    try {
      await navigator.clipboard.writeText(this.buildDetailsText());
      toast.success("Detalles copiados al portapapeles");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, eventId, componentStack, timestamp } = this.state;
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

            <details
              open={openByDefault}
              className="rounded-md border bg-muted/50 text-xs"
            >
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
              <Button variant="outline" onClick={this.handleReset}>
                <RefreshCw className="h-4 w-4 mr-1" /> Reintentar
              </Button>
              <Button onClick={() => { window.location.href = "/"; }}>
                Ir al inicio
              </Button>
              <Button variant="secondary" onClick={this.handleReportFeedback}>
                <MessageSquarePlus className="h-4 w-4 mr-1" /> Reportar
              </Button>
              <Button variant="ghost" onClick={this.handleCopyDetails}>
                <ClipboardCopy className="h-4 w-4 mr-1" /> Copiar detalles
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
