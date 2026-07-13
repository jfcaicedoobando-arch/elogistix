import React from "react";
import * as Sentry from "@sentry/react";
import { AlertTriangle, MessageSquarePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { logClientError } from "@/services/observability";
import { logger } from "@/lib/observability/logger";
import {
  isDynamicImportError,
  tryReloadForChunkError,
} from "@/lib/errors/dynamicImportError";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

/**
 * ErrorBoundary con doble reporte:
 *  - `Sentry.captureException` con `componentStack` y `eventId` capturado para
 *    poder ofrecer el widget de feedback pre-llenado (usuario reporta directo
 *    sobre el evento que rompió la UI).
 *  - `logClientError` (edge function) para persistir en `app_logs` y poder
 *    cruzar con métricas de negocio sin depender de Sentry.
 *  - Recuperación automática para errores de chunks stale (Vite).
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, eventId: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("ErrorBoundary", error, { componentStack: errorInfo.componentStack });

    if (isDynamicImportError(error)) {
      tryReloadForChunkError();
      return;
    }
    let eventId: string | null = null;
    Sentry.withScope((scope) => {
      scope.setTag("source", "react-error-boundary");
      // 13.63.0: tag por ruta para filtrar en Sentry qué pantalla rompió.
      // Usar pathname (sin query) para evitar PII en el tag.
      if (typeof window !== "undefined") {
        scope.setTag("crashed_route", window.location.pathname || "/");
      }
      if (errorInfo.componentStack) {
        scope.setContext("react", { componentStack: errorInfo.componentStack });
      }
      eventId = Sentry.captureException(error);
    });
    if (eventId) {
      this.setState({ eventId });
    }
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
    this.setState({ hasError: false, error: null, eventId: null });
  };

  handleReportFeedback = async () => {
    const eventId = this.state.eventId ?? undefined;
    // 1) Intentar widget de feedback (Sentry Feedback integration).
    try {
      const feedback = Sentry.getFeedback?.();
      if (feedback) {
        const form = await feedback.createForm({ eventId });
        form.appendToDom();
        form.open();
        if (eventId) {
          Sentry.getCurrentScope().setTag("crash_event_id", eventId);
        }
        return;
      }
    } catch (err) {
      logger.warn("ErrorBoundary.feedback.widgetFailed", { err: String(err) });
    }
    // 2) Fallback: diálogo clásico de reporte (sólo requiere eventId + DSN).
    try {
      if (eventId && typeof Sentry.showReportDialog === "function") {
        Sentry.showReportDialog({ eventId });
        return;
      }
    } catch (err) {
      logger.warn("ErrorBoundary.feedback.dialogFailed", { err: String(err) });
    }
    // 3) Último recurso: abrir correo con el eventId prellenado.
    const subject = encodeURIComponent(
      `Reporte de error en Libre Carga${eventId ? ` (${eventId})` : ""}`,
    );
    const body = encodeURIComponent(
      [
        "Describe lo que estabas haciendo cuando ocurrió el error:",
        "",
        "",
        "---",
        `ID del evento: ${eventId ?? "(sin ID)"}`,
        `Ruta: ${typeof window !== "undefined" ? window.location.pathname : ""}`,
        `Mensaje: ${this.state.error?.message ?? ""}`,
      ].join("\n"),
    );
    window.location.href = `mailto:soporte@librecarga.com?subject=${subject}&body=${body}`;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[50vh] p-6">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
              <h2 className="text-lg font-semibold">Algo salió mal</h2>
              <p className="text-sm text-muted-foreground">
                Ocurrió un error inesperado al cargar esta sección. Puedes intentar recargar o volver al inicio.
              </p>
              {this.state.error && (
                <pre className="text-xs text-left bg-muted rounded-md p-3 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
              {this.state.eventId && (
                <p className="text-2xs text-muted-foreground font-mono">
                  ID del evento: {this.state.eventId}
                </p>
              )}
              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="outline" onClick={this.handleReset}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reintentar
                </Button>
                <Button onClick={() => { window.location.href = "/"; }}>
                  Ir al inicio
                </Button>
                {this.state.eventId && (
                  <Button variant="secondary" onClick={this.handleReportFeedback}>
                    <MessageSquarePlus className="h-4 w-4 mr-1" /> Reportar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
