/**
 * Helpers de ordenamiento reutilizables para columnas nativas de TanStack
 * (`ColumnDef<T>` + `defineColumns`).
 *
 * Replican exactamente el comportamiento que el adapter legacy aplicaba
 * detrás de `sortValue` (ver `columnAdapter.ts`):
 *   - Strings → `Intl.Collator("es-MX", { sensitivity: "base" })`
 *   - Números → resta directa.
 *   - Fechas (ISO o Date) → comparación numérica de timestamps.
 *   - `null`/`undefined` siempre van al final, sin importar la dirección.
 *
 * Mantenerlos centralizados garantiza que la Fase 2 (migración a
 * `ColumnDef` nativo) NO introduzca divergencias de orden vs. la versión
 * legacy mientras ambos coexistan.
 */
import type { Row, SortingFn } from "@tanstack/react-table";

export const esCollator = new Intl.Collator("es-MX", { sensitivity: "base" });

function nullAwareNumber<T>(
  extract: (row: T) => number | null | undefined,
): SortingFn<T> {
  return (a: Row<T>, b: Row<T>) => {
    const va = extract(a.original);
    const vb = extract(b.original);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return va - vb;
  };
}

export function sortByString<T>(extract: (row: T) => string | null | undefined): SortingFn<T> {
  return (a, b) => {
    const va = extract(a.original);
    const vb = extract(b.original);
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return esCollator.compare(va, vb);
  };
}

export function sortByNumber<T>(extract: (row: T) => number | null | undefined): SortingFn<T> {
  return nullAwareNumber(extract);
}

export function sortByDate<T>(
  extract: (row: T) => string | Date | null | undefined,
): SortingFn<T> {
  return nullAwareNumber<T>((row) => {
    const v = extract(row);
    if (!v) return null;
    const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  });
}
