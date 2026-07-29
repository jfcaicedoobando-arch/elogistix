/**
 * Tipos compartidos para las utilidades de notificación toast.
 */

/**
 * Firma laxa retenida sólo por compatibilidad con call sites que aún pasan
 * el `toast` del antiguo shadcn `useToast`. El argumento se ignora — usamos
 * `never` en posición contravariante para aceptar cualquier toast (shadcn
 * `{title,...}`, sonner, etc.) bajo `strictFunctionTypes`.
 */
export type AnyToastFn = (props: never) => unknown;

export interface ErrorNotifyOptions {
  step?: number;
  phase?: string;
  errors?: Record<string, string>;
  message?: string;
  description?: string;
  title?: string;
  error?: unknown;
  context?: Record<string, unknown>;
  errorCode?: string;
  method?: string;
  /** Payload original de la operación; se sanitiza antes de Sentry. */
  payload?: unknown;
  /** Correlation ID si el backend lo devolvió. */
  requestId?: string;
  /**
   * Q-08 — Acción primaria del toast (p. ej. "Reintentar"). Cuando viene,
   * "Ver detalles" pasa a acción secundaria y NUNCA se navega fuera de la
   * pantalla actual (perdía wizards a medio llenar).
   */
  action?: { label: string; onClick: () => void };
}

/** Opciones comunes para success/warning/info (todas con debug opcional). */
export interface InfoNotifyOptions {
  title: string;
  description?: string;
  duration?: number;
  /** ID de dedupe (pasa a sonner). */
  id?: string | number;
  /** Si viene `error`/`context`/`method`/`payload`/`requestId` o `showDetails=true`,
   *  el toast incluye acción "Ver detalles". */
  error?: unknown;
  context?: Record<string, unknown>;
  method?: string;
  payload?: unknown;
  requestId?: string;
  errorCode?: string;
  /** Fuerza el botón "Ver detalles" aunque no haya error/contexto. */
  showDetails?: boolean;
  /** Toast persistente (no auto-dismiss). Equivale a `duration: Infinity`. */
  persistent?: boolean;
  /**
   * Acción custom (label + onClick). Si viene, se prioriza sobre "Ver detalles".
   * Usar para flujos donde el toast necesita CTA explícito (p.ej. "Reintentar").
   */
  action?: { label: string; onClick: () => void };
}
