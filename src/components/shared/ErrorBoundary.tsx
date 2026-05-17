import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/constants/appVersion";

const CHUNK_ERROR_RELOAD_KEY = "chunk-error-auto-reload";

const isDynamicImportError = (error: Error | null) => {
  if (!error) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("dynamically imported module") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror")
  );
};

const tryReloadForChunkError = () => {
  if (typeof window === "undefined") return false;
  if (window.sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY) === "1") return false;

  window.sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, "1");
  window.location.reload();
  return true;
};

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);

    if (isDynamicImportError(error)) {
      tryReloadForChunkError();
      return;
    }

    // Reporte a app_logs vía edge function. Fire-and-forget; nunca debe romper la UI.
    try {
      void supabase.functions.invoke("client-error-log", {
        body: {
          message: error.message,
          stack: error.stack,
          component_stack: errorInfo.componentStack,
          route: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          app_version: APP_VERSION,
        },
      });
    } catch {
      // ignorar — no queremos cascadas de error
    }
  }

  handleReset = () => {
    if (isDynamicImportError(this.state.error) && tryReloadForChunkError()) {
      return;
    }

    this.setState({ hasError: false, error: null });
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
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={this.handleReset}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reintentar
                </Button>
                <Button onClick={() => { window.location.href = "/"; }}>
                  Ir al inicio
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
