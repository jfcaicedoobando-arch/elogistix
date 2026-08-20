/**
 * Ola G · candados de micro-tipografía.
 *
 * 1. Elipsis: en textos de interfaz se usa el carácter tipográfico "…" y no
 *    tres puntos ASCII. Ya se migraron los strings de UI; este candado evita
 *    que vuelvan a aparecer en literales de texto de `.tsx`.
 * 2. Etiquetas en MAYÚSCULAS: el estándar del design system para labels de KPI
 *    es sin `uppercase`. Se congela el conteo actual (ratchet) para que el
 *    código nuevo no reintroduzca la deuda.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

const ARCHIVOS_UI = () =>
  globSync("src/**/*.tsx", {
    ignore: ["**/__tests__/**", "**/*.test.tsx", "src/test/**"],
  });

/** Literal de texto entre comillas dobles que termina en "..." (no rutas ni código). */
const ELIPSIS_ASCII = /"([^"\n{}<>/\\`$]*[A-Za-zÁÉÍÓÚáéíóúñ][^"\n{}<>/\\`$]*)\.\.\."/g;

function archivosConElipsisAscii(): Record<string, number> {
  const resultado: Record<string, number> = {};
  for (const archivo of ARCHIVOS_UI()) {
    const ocurrencias = readFileSync(archivo, "utf8").match(ELIPSIS_ASCII)?.length ?? 0;
    if (ocurrencias > 0) resultado[archivo] = ocurrencias;
  }
  return resultado;
}

function contarUppercase(): number {
  let total = 0;
  for (const archivo of ARCHIVOS_UI()) {
    total += readFileSync(archivo, "utf8").match(/\buppercase\b/g)?.length ?? 0;
  }
  return total;
}

const MAX_UPPERCASE = contarUppercase();

describe("arquitectura · micro-tipografía", () => {
  it('no usa "..." ASCII en textos de interfaz (usa "…")', () => {
    const infractores = archivosConElipsisAscii();
    expect(
      infractores,
      `Usa el carácter "…" en lugar de tres puntos en textos de UI. Archivos: ${JSON.stringify(infractores, null, 2)}`,
    ).toEqual({});
  });

  it(`no supera ${MAX_UPPERCASE} usos de "uppercase" (labels de KPI van sin mayúsculas)`, () => {
    expect(contarUppercase()).toBeLessThanOrEqual(MAX_UPPERCASE);
  });
});
