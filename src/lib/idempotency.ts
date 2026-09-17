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
/**
 * MNY P1.4 — llave ligada al contenido de la operación.
 *
 * Una llave de idempotencia sólo debe reproducir la respuesta guardada si el
 * payload es EL MISMO. Si el usuario cambia destino, monto o fecha y reintenta,
 * reutilizar la llave hacía que el servidor devolviera la operación anterior
 * (éxito falso). `get(scope)` conserva la llave mientras el `scope` no cambie y
 * genera una nueva en cuanto el payload difiere.
 */
export interface PayloadRequestId {
  get: (scope: string) => string;
  reset: () => void;
}

/** Serializa las partes relevantes del payload en un `scope` comparable. */
export function scopeDePayload(
  partes: ReadonlyArray<string | number | boolean | null | undefined>,
): string {
  return partes.map((p) => (p === null || p === undefined ? "" : String(p))).join("|");
}

export function usePayloadRequestId(): PayloadRequestId {
  const ref = useRef<{ scope: string; id: string } | null>(null);
  const get = useCallback((scope: string) => {
    if (!ref.current || ref.current.scope !== scope) {
      ref.current = { scope, id: newRequestId() };
    }
    return ref.current.id;
  }, []);
  const reset = useCallback(() => {
    ref.current = null;
  }, []);
  return { get, reset };
}

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
