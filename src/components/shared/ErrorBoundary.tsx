import React from "react";
import { logClientError } from "@/services/observability";
import { captureExceptionOnce } from "@/lib/observability/captureExceptionOnce";
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
    if (isDynamicImportError(error) && tryReloadForChunkError()) {
      Object.assign(error, { expected: true });
      return;
    }

    const timestamp = new Date().toISOString();

    this.setState({
      eventId: null,
      componentStack: errorInfo.componentStack ?? null,
      timestamp,
    });

    void captureExceptionOnce(error, {
      tags: { source: "react-error-boundary", app_version: APP_VERSION,
        crashed_route: typeof window !== "undefined" ? window.location.pathname : "/" },
      contexts: { react: { componentStack: errorInfo.componentStack } },
    }).then((eventId) => {
      if (this.state.error === error) this.setState({ eventId: eventId ?? null });
    });

    logClientError({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.state.hasError &&
      prevProps.resetKey !== undefined &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({
        hasError: false,
        error: null,
        eventId: null,
        componentStack: null,
        timestamp: null,
      });
    }
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
