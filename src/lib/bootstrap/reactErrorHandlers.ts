import { captureExceptionOnce } from "@/lib/observability/captureExceptionOnce";
import { isDynamicImportError, tryReloadForChunkError } from "@/lib/errors/dynamicImportError";
import { renderBootstrapFallback } from "./renderBootstrapFallback";

function report(error: unknown, info: { componentStack?: string | null }, source: string): void {
  if (isDynamicImportError(error) && tryReloadForChunkError()) {
    if (error instanceof Error) Object.assign(error, { expected: true });
    return;
  }
  void captureExceptionOnce(error, {
    tags: { source },
    contexts: { react: { componentStack: info.componentStack } },
  });
}

/** React 19 reports render errors asynchronously, outside root.render's catch. */
export const reactErrorHandlers = {
  onUncaughtError(error: unknown, info: { componentStack?: string | null }): void {
    report(error, info, "react-root-uncaught");
    renderBootstrapFallback(error);
  },
  onCaughtError(error: unknown, info: { componentStack?: string | null }): void {
    report(error, info, "react-root-caught");
  },
  onRecoverableError(error: unknown, info: { componentStack?: string | null }): void {
    report(error, info, "react-root-recoverable");
  },
};
