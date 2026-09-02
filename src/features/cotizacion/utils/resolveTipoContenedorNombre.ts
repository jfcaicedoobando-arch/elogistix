/**
 * Resuelve `tipo_contenedor` (UUID nuevo o string legacy) a un nombre legible.
 *
 * - Si `value` es un UUID que existe en el catálogo, devuelve `name`.
 * - Si `value` es un string legacy (p.ej. "20'", "40HC"), lo devuelve tal cual.
 * - Si no se puede resolver, devuelve `fallback` (por defecto `"—"`).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TipoContenedorCatalogo {
  id: string;
  name: string;
  code?: string;
  /**
   * P1 (2026-09-02): el catálogo de selección colapsa duplicados; un valor
   * guardado puede apuntar al ID legacy equivalente y debe seguir resolviéndose.
   */
  idsEquivalentes?: string[];
}

export function resolveTipoContenedorNombre(
  value: string | null | undefined,
  catalogo: ReadonlyArray<TipoContenedorCatalogo> = [],
  fallback = "—",
): string {
  const v = (value ?? "").trim();
  if (!v) return fallback;

  if (UUID_RE.test(v)) {
    const match =
      catalogo.find((t) => t.id === v) ??
      catalogo.find((t) => t.idsEquivalentes?.includes(v));
    return match?.name ?? match?.code ?? fallback;
  }

  return v;
}
