/**
 * Idempotency helpers for critical mutations (A.3).
 *
 * `newRequestId` genera un UUID nuevo. `useStableRequestId` mantiene el mismo
 * UUID mientras el usuario reintenta una operación tras un error y lo regenera
 * sólo cuando la operación termina exitosamente. Esto permite que un reintento
 * explícito desde la UI viaje al backend con el mismo `p_request_id` y la RPC
 * devuelva la respuesta cacheada en vez de duplicar el registro.
 *
 * Uso típico:
 *
 *   const reqId = useStableRequestId();
 *   const onSubmit = async () => {
 *     await mutateAsync({ ..., requestId: reqId.get() });
 *     reqId.reset(); // próximo submit usará un id nuevo
 *   };
 */
import { useRef, useCallback } from "react";

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface StableRequestId {
  /** Devuelve el id actual (lo crea si aún no existe). */
  get: () => string;
  /** Limpia el id para que el próximo `get()` genere uno nuevo. */
  reset: () => void;
}

/**
 * Mantiene un requestId estable entre reintentos. Llamar `reset()` tras éxito.
 */
export function useStableRequestId(): StableRequestId {
  const ref = useRef<string | null>(null);
  const get = useCallback(() => {
    if (!ref.current) ref.current = newRequestId();
    return ref.current;
  }, []);
  const reset = useCallback(() => {
    ref.current = null;
  }, []);
  return { get, reset };
}
