import React from "react";
import { logClientError } from "@/services/observability";
import { logger } from "@/lib/observability/logger";
import {
  isDynamicImportError,
  tryReloadForChunkError,
} from "@/lib/errors/dynamicImportError";
import { APP_VERSION } from "@/constants/appVersion";
import { ErrorBoundaryFallback } from "./errorBoundary/ErrorBoundaryFallback";
import {
  copyDetails,
  openReportFeedback,
} from "./errorBoundary/reportFeedback";

interface Props {
  children: React.ReactNode;
  /**
   * Q-08 — Al cambiar este valor (típicamente la ruta activa) el boundary se
   * limpia solo, para que un error viejo no quede pegado al navegar a otra
   * pantalla sana.
   */
  resetKey?: string;
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
 * UI y helpers de reporte extraídos a `./errorBoundary/*` para respetar
 * Power of 10 (≤ 200 líneas por archivo).
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

    this.setState({
      eventId: null,
      componentStack: errorInfo.componentStack ?? null,
      timestamp,
    });

    void import("@sentry/react").then((Sentry) => {
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
      this.setState({ eventId });
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

  handleReport = () => {
    void openReportFeedback(this.state, (id) => this.setState({ eventId: id }));
  };

  handleCopyDetails = () => {
    void copyDetails(this.state);
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { error, eventId, componentStack, timestamp } = this.state;
    return (
      <ErrorBoundaryFallback
        error={error}
        eventId={eventId}
        componentStack={componentStack}
        timestamp={timestamp}
        onReset={this.handleReset}
        onReport={this.handleReport}
        onCopyDetails={this.handleCopyDetails}
      />
    );
  }
}
