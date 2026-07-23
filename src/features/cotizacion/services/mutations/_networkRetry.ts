/**
 * Helpers de red compartidos por los servicios de envío por correo.
 * Extraído para respetar Power-of-10 (≤200 líneas).
 */
export const OFFLINE_MSG =
  "Tu conexión a internet está caída. Reconéctate e intenta de nuevo.";

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/**
 * Espera a que vuelva el evento `online` o a que pase `timeoutMs`.
 * Si ya estamos online, regresa de inmediato.
 */
function esperarOnline(timeoutMs: number): Promise<void> {
  if (isOnline()) return Promise.resolve();
  if (typeof window === "undefined") return new Promise((r) => setTimeout(r, timeoutMs));
  return new Promise((resolve) => {
    const onOnline = () => {
      window.removeEventListener("online", onOnline);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      window.removeEventListener("online", onOnline);
      resolve();
    }, timeoutMs);
    window.addEventListener("online", onOnline);
  });
}

export async function fetchConReintento(url: string, init: RequestInit): Promise<Response> {
  if (!isOnline()) throw new TypeError(OFFLINE_MSG);
  // 5 intentos: 0 / 1s / 2s / 4s / 8s (~15s totales) — cubre microcortes de red.
  const delays = [0, 1000, 2000, 4000, 8000];
  let lastErr: unknown;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      // Sólo reintentamos errores de red (TypeError: Failed to fetch).
      const isNet = e instanceof TypeError;
      if (!isNet) throw e;
      // Si quedamos offline, esperar a recuperar conexión (tope 10s) antes del siguiente intento.
      if (!isOnline() && i < delays.length - 1) await esperarOnline(10000);
    }
  }
  throw lastErr;
}
