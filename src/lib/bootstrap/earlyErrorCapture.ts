import { captureExceptionOnce } from "@/lib/observability/captureExceptionOnce";

/** Cover the async SDK import gap without blocking paint or keeping duplicate listeners. */
export function registerEarlyErrorCapture(target: Window = window): () => void {
  let remaining = 20;
  const report = (error: unknown) => {
    if (remaining-- <= 0) return;
    void captureExceptionOnce(error, { tags: { source: "bootstrap-window" } });
  };
  const onError = (event: ErrorEvent) => report(event.error ?? new Error(event.message));
  const onRejection = (event: PromiseRejectionEvent) => report(event.reason);
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
