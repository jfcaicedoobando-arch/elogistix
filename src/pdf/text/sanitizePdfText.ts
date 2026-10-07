/**
 * Normalización visual histórica de rutas y comillas al imprimir un PDF.
 * Se conserva con Inter local para no cambiar etiquetas o texto de documentos
 * existentes; nunca modifica los valores guardados en la base.
 */

const REEMPLAZOS: ReadonlyArray<[RegExp, string]> = [
  // Flechas → separador de ruta legible.
  [/[\u2190\u2192\u2794\u27F6\u21D2\u21D0\u2B95]/g, "-"],
  // Flecha de continuación (subfilas) → viñeta.
  [/[\u21B3\u21AA\u2937]/g, "\u00B7"],
  // Comillas tipográficas y guiones largos poco fiables en algunos visores.
  [/[\u2018\u2019]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
];

/** Devuelve el texto normalizado sólo para su presentación en PDF. */
export function sanitizePdfText(input: string | null | undefined): string {
  if (input == null) return "";
  return REEMPLAZOS.reduce((txt, [re, rep]) => txt.replace(re, rep), String(input));
}
