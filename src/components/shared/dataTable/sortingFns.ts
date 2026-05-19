/**
 * Helpers de ordenamiento reutilizables para columnas nativas de TanStack
 * (`ColumnDef<T>` + `defineColumns`).
 *
 * Contrato uniforme para todas las columnas del ERP:
 *   - Strings → `Intl.Collator("es-MX", { sensitivity: "base" })` para que
 *     acentos y mayúsculas no afecten el orden (esperado en es-MX).
 *   - Números → resta directa.
 *   - Fechas (ISO o `Date`) → comparación numérica de timestamps;
 *     strings inválidos se tratan como null.
 *   - `null` / `undefined` van **siempre al final**, sin importar la
 *     dirección (asc o desc). Cualquier desviación rompe la UX del listado.
 *
 * Si alguna columna necesita un sort exótico, escribe un `SortingFn<T>`
 * ad-hoc pero **mantén el contrato null-last**.
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
