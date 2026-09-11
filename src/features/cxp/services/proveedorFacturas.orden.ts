/**
 * Orden global del listado `/compras/facturas`.
 *
 * La pantalla lee TODAS las facturas que cumplen los filtros y luego corta la
 * página. Antes el orden lo aplicaba TanStack sobre la página ya cortada, así
 * que "ordenar por folio" sólo acomodaba las 100 filas visibles. Aquí vive el
 * comparador que ordena el conjunto completo ANTES de cortar.
 *
 * Contrato (espejo de `dataTable/sortingFns.ts`):
 *  - Texto → `Intl.Collator("es-MX", { sensitivity: "base" })`.
 *  - Números y fechas → comparación por valor.
 *  - Vacíos (`null`/`""`/fecha inválida) SIEMPRE al final, en asc y en desc.
 */
import type { FacturaCxP } from "./proveedorFacturas.types";

export const CXP_SORT_KEY_DEFAULT = "folio_interno";
export type CxpSortDir = "asc" | "desc";

const collator = new Intl.Collator("es-MX", { sensitivity: "base" });

type Extractor =
  | { tipo: "texto"; get: (f: FacturaCxP) => string | null | undefined }
  | { tipo: "numero"; get: (f: FacturaCxP) => number | null | undefined }
  | { tipo: "fecha"; get: (f: FacturaCxP) => string | null | undefined };

/** columnId (ver `cxpColumns.tsx`) → cómo extraer y comparar el valor. */
export const CXP_ORDEN: Record<string, Extractor> = {
  folio_interno: { tipo: "texto", get: (f) => f.folio_interno },
  folio: { tipo: "texto", get: (f) => f.folio_proveedor },
  proveedor: { tipo: "texto", get: (f) => f.proveedor_nombre },
  emision: { tipo: "fecha", get: (f) => f.fecha_emision },
  vencimiento: { tipo: "fecha", get: (f) => f.fecha_vencimiento },
  moneda: { tipo: "texto", get: (f) => f.moneda },
  total: { tipo: "numero", get: (f) => f.total },
  pagado: { tipo: "numero", get: (f) => f.pagado },
  saldo: { tipo: "numero", get: (f) => f.saldo },
  estado: { tipo: "texto", get: (f) => f.estatus },
};

function aTimestamp(v: string | null | undefined): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Compara dos facturas por la columna dada. Devuelve el orden ascendente. */
function comparar(a: FacturaCxP, b: FacturaCxP, ex: Extractor): number {
  if (ex.tipo === "texto") {
    const va = ex.get(a) || null;
    const vb = ex.get(b) || null;
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return collator.compare(va, vb);
  }
  const va = ex.tipo === "fecha" ? aTimestamp(ex.get(a)) : (ex.get(a) ?? null);
  const vb = ex.tipo === "fecha" ? aTimestamp(ex.get(b)) : (ex.get(b) ?? null);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return va - vb;
}

/**
 * Ordena una copia del arreglo completo. Los vacíos quedan al final incluso en
 * `desc` (no se invierte su posición).
 */
export function ordenarFacturasCxP(
  rows: readonly FacturaCxP[],
  key: string | null,
  dir: CxpSortDir,
): FacturaCxP[] {
  const ex = key ? CXP_ORDEN[key] : undefined;
  if (!ex) return [...rows];
  const factor = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const base = comparar(a, b, ex);
    // Un lado vacío devuelve ±1 desde `comparar`; detectarlo por el valor
    // extraído mantiene el contrato null-last en ambas direcciones.
    const aVacio = esVacio(a, ex);
    const bVacio = esVacio(b, ex);
    if (aVacio !== bVacio) return aVacio ? 1 : -1;
    return base * factor;
  });
}

function esVacio(f: FacturaCxP, ex: Extractor): boolean {
  if (ex.tipo === "texto") return !ex.get(f);
  if (ex.tipo === "fecha") return aTimestamp(ex.get(f)) == null;
  return ex.get(f) == null;
}
