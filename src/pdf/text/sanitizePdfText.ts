/**
 * Las fuentes built-in de @react-pdf/renderer (Helvetica) sólo cubren WinAnsi.
 * Caracteres como "→" o "↳" no existen en ese set y el visor los dibuja como
 * un glifo equivocado (se veían como "'" o "³" en las cotizaciones).
 *
 * Este helper normaliza el texto justo antes de imprimirlo en el PDF, sin
 * tocar los datos guardados en la base.
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

/** Devuelve el texto listo para imprimirse con fuentes WinAnsi. */
export function sanitizePdfText(input: string): string {
  return REEMPLAZOS.reduce((txt, [re, rep]) => txt.replace(re, rep), input);
}
