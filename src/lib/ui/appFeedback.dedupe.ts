/**
 * Deduplicado de toasts: evita que el mismo mensaje (mismo tipo + título +
 * descripción) aparezca dos veces en una ventana corta — p. ej. cuando un
 * `useEffect` se dispara dos veces en StrictMode o un doble clic dispara la
 * misma mutación fallida dos veces seguidas.
 */

/** Ventana dentro de la cual un toast idéntico se considera duplicado. */
export const TOAST_DEDUPE_WINDOW_MS = 4000;

const lastShownAt = new Map<string, number>();

/** Clave estable de contenido para deduplicar (no incluye IDs generados). */
export function computeToastDedupeKey(
  kind: string,
  title: string,
  description?: string,
): string {
  return `${kind}|${title}|${description ?? ""}`;
}

/**
 * ¿Debe suprimirse este toast por ser un duplicado reciente? Si no se
 * suprime, registra el timestamp para futuras comparaciones.
 */
export function shouldSuppressDuplicateToast(key: string, now: number = Date.now()): boolean {
  const prev = lastShownAt.get(key);
  if (prev !== undefined && now - prev < TOAST_DEDUPE_WINDOW_MS) {
    return true;
  }
  lastShownAt.set(key, now);
  return false;
}

/** Sólo para pruebas: limpia el estado de deduplicado entre casos. */
export function resetToastDedupeState() {
  lastShownAt.clear();
}
