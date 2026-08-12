import { getErrorMessage } from "@/lib/errors";

/**
 * UIB-01: nunca mostrar `err.message` crudo en la landing pública — los errores
 * de `functions.invoke` llegan en inglés ("Edge Function returned a non-2xx
 * status code"). El mensaje técnico sigue yendo a "Ver detalles"/Sentry vía
 * `error: err`.
 */
export function mensajeAmigableDemo(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  const m = raw.toLowerCase();
  if (m.includes("non-2xx") || m.includes("failed to fetch") || m.includes("network")) {
    return "No pudimos abrir la demo en este momento. Intenta de nuevo en unos minutos.";
  }
  if (m.includes("permission denied") || m.includes("row-level security")) {
    return "No pudimos registrar tus datos. Intenta de nuevo o escríbenos a contacto@librecarga.com.";
  }
  const traducido = getErrorMessage(err);
  // Si el helper central no tradujo (devolvió el crudo), usar copy propio.
  if (!traducido || traducido === raw) {
    return "No pudimos abrir la demo. Intenta de nuevo en un momento.";
  }
  return traducido;
}
