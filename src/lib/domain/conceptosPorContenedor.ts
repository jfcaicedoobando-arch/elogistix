/**
 * Helpers para agrupar conceptos (venta/costo) por contenedor.
 *
 * v12.6.0 — refactor 1 embarque ↔ N contenedores. Un concepto con
 * `contenedor_id = null` se considera "general" (aplica a todo el embarque).
 */

export interface ConceptoConContenedor {
  id: string;
  contenedor_id: string | null;
}

export interface AgrupacionConceptos<T extends ConceptoConContenedor> {
  porContenedor: Record<string, T[]>;
  generales: T[];
}

export function agruparPorContenedor<T extends ConceptoConContenedor>(
  conceptos: readonly T[],
  contenedorIds: readonly string[],
): AgrupacionConceptos<T> {
  const porContenedor: Record<string, T[]> = {};
  for (const id of contenedorIds) porContenedor[id] = [];
  const generales: T[] = [];

  for (const c of conceptos) {
    if (c.contenedor_id && porContenedor[c.contenedor_id]) {
      porContenedor[c.contenedor_id].push(c);
    } else {
      // contenedor_id null o referencia a contenedor inexistente (soft-deleted)
      generales.push(c);
    }
  }
  return { porContenedor, generales };
}

/**
 * Filtra conceptos según el filtro elegido en el wizard de proforma.
 *  - `'todos'`       → todos los conceptos
 *  - `'generales'`   → sólo los que NO tienen contenedor asignado
 *  - `<uuid>`        → los del contenedor + los generales (siempre incluidos
 *                      porque también aplican a ese contenedor)
 */
export type FiltroContenedor = 'todos' | 'generales' | string;

export function filtrarPorContenedor<T extends ConceptoConContenedor>(
  conceptos: readonly T[],
  filtro: FiltroContenedor,
): T[] {
  if (filtro === 'todos') return [...conceptos];
  if (filtro === 'generales') return conceptos.filter((c) => !c.contenedor_id);
  return conceptos.filter((c) => c.contenedor_id === filtro || !c.contenedor_id);
}
