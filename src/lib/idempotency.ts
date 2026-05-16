/**
 * Idempotency helper for critical mutations (A.3).
 *
 * Genera un identificador UUID estable por intento del usuario. Si la red
 * reintenta o el usuario hace doble-click, el mismo `requestId` viaja al
 * backend y la RPC devuelve la respuesta cacheada en lugar de duplicar.
 *
 * Uso típico en un componente de formulario:
 *
 *   const requestIdRef = useRef<string>(newRequestId());
 *   // pásalo al hook de mutación; resetéalo en onSuccess
 */
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (no debería ocurrir en navegadores modernos)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
