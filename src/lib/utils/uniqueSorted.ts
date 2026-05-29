/**
 * Deriva una lista única y ordenada (es-MX, case-insensitive) a partir de
 * un arreglo y un selector. Reemplaza el patrón repetido en ~6 controllers
 * (admin, facturación, portal, auditoría):
 *
 *   Array.from(new Set(items.map(fn))).filter(Boolean).sort()
 *
 * Uniforma el orden (locale-aware) y el filtrado de valores vacíos.
 */
export function uniqueSorted<T>(
  arr: readonly T[],
  selector: (x: T) => string | null | undefined,
): string[] {
  const set = new Set<string>();
  for (const item of arr) {
    const v = selector(item);
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es-MX", { sensitivity: "base" }));
}
