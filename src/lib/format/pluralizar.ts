/**
 * Q-16.1 — Pluralización mexicana de contadores.
 *
 * Evita textos como "1 embarques" o "2 embarque". Uso típico:
 *   pluralizar(count, "embarque") -> "1 embarque" | "2 embarques"
 *   pluralizar(count, "embarque", { includeCount: false }) -> "embarque" | "embarques"
 */
export interface PluralizarOptions {
  /** Forma plural explícita (si no es sólo agregar "s"), ej. "luz" → "luces". */
  plural?: string;
  /** Si es `false`, no antepone el número al resultado. Default: `true`. */
  includeCount?: boolean;
}

export function pluralizar(
  count: number,
  singular: string,
  options: PluralizarOptions = {},
): string {
  const { plural, includeCount = true } = options;
  const n = Number.isFinite(count) ? count : 0;
  const palabra = n === 1 ? singular : plural ?? `${singular}s`;
  return includeCount ? `${n} ${palabra}` : palabra;
}
