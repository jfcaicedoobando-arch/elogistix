/**
 * Traducción de `meta.width` (clases Tailwind) a valores válidos de
 * `grid-template-columns` para las tablas virtualizadas.
 *
 * Las tablas normales aplican `meta.width` como clase CSS, pero
 * `VirtualDataTable` arma un grid y necesita longitudes CSS reales: pasarle
 * `w-[104px]` o `w-24` invalida toda la declaración y las columnas se apilan
 * verticalmente. Aquí convertimos los peldaños de `COL_W` (y la escala de
 * spacing de Tailwind) a px/rem, y cualquier valor desconocido cae a
 * `minmax(0,1fr)` para nunca romper el grid.
 */
const ARBITRARY = /^(?:min-)?w-\[([^\]]+)\]$/;
const SPACING = /^(?:min-)?w-(\d+(?:\.\d+)?)$/;

export const FLEX_COL = "minmax(0,1fr)";

/** Convierte un `meta.width` en un track válido de grid. */
export function widthToTrack(width: string | undefined): string {
  if (!width) return FLEX_COL;
  const raw = width.trim();

  const arbitrario = ARBITRARY.exec(raw);
  if (arbitrario) {
    const valor = arbitrario[1];
    return raw.startsWith("min-w-") ? `minmax(${valor},1fr)` : valor;
  }

  const spacing = SPACING.exec(raw);
  if (spacing) {
    const rem = `${Number(spacing[1]) * 0.25}rem`;
    return raw.startsWith("min-w-") ? `minmax(${rem},1fr)` : rem;
  }

  if (raw === "w-full" || raw === "w-auto") return FLEX_COL;

  return FLEX_COL;
}

/** Arma el `grid-template-columns` a partir de los anchos de las columnas. */
export function gridTemplateFromWidths(widths: ReadonlyArray<string | undefined>): string {
  return widths.map(widthToTrack).join(" ");
}
