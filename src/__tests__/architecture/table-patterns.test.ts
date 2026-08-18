/**
 * Guardrails de estandarización de tablas y listados (v13.435.0).
 *
 * 1. Densidad: ningún archivo de `src/features` puede pasar la densidad de
 *    tabla como string literal — debe usar `TABLE_DENSITY` de
 *    `@/components/shared/dataTable/tableTokens`.
 * 2. Paginación: nadie construye botones "Anterior"/"Siguiente" propios;
 *    todo listado usa `PaginationControls` (directo o vía `DataTable`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { walk } from "../../../scripts/lib/walk";

const ROOT = process.cwd();
const FEATURES = join(ROOT, "src", "features");

/** Valores válidos de `<CardContent density="...">` (otra escala, otro componente). */
const CARD_DENSITIES = new Set(["default", "compact", "tight", "flush"]);

/** Componentes con su propia escala de densidad (no son tablas). */
const NO_TABLA = /^(Card(Content|Header|Footer)?|EmptyStateInline|ErrorStateInline)$/;

/** Etiqueta JSX abierta a la que pertenece la prop de la línea `i`. */
function tagDeLaProp(lines: readonly string[], i: number): string {
  for (let j = i; j >= 0 && j > i - 12; j -= 1) {
    const m = lines[j].match(/<([A-Za-z][A-Za-z0-9]*)\b/);
    if (m) return m[1];
  }
  return "";
}

function archivos(): string[] {
  return [...walk(FEATURES, { excludeFileRe: /\.(test|spec)\.tsx?$/ })];
}

describe("Densidad de tablas — un solo token", () => {
  it('ningún feature pasa density="compact|comfortable" a una tabla', () => {
    const violaciones: string[] = [];
    for (const f of archivos()) {
      const rel = relative(ROOT, f);
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => {
        const m = line.match(/density="(compact|comfortable)"/);
        if (!m) return;
        // `<CardContent density="compact">` y los estados inline son otra escala.
        const tag = /<[A-Za-z]/.test(line) ? (line.match(/<([A-Za-z][A-Za-z0-9]*)\b/)?.[1] ?? "") : tagDeLaProp(lines, i);
        if (NO_TABLA.test(tag) && CARD_DENSITIES.has(m[1])) return;
        violaciones.push(`  ${rel}:${i + 1} → ${m[0]}`);
      });
    }

    expect(
      violaciones,
      "Usa TABLE_DENSITY.listado (páginas de listado) o TABLE_DENSITY.embebida\n" +
        "(tablas en cards/tabs/diálogos) de @/components/shared/dataTable/tableTokens.\n\n" +
        violaciones.join("\n"),
    ).toEqual([]);
  });
});

describe("Paginación — patrón único", () => {
  it("ningún feature reimplementa botones de Anterior/Siguiente de tabla", () => {
    const violaciones: string[] = [];
    for (const f of archivos()) {
      const rel = relative(ROOT, f);
      const src = readFileSync(f, "utf8");
      // Los wizards también usan "Anterior"/"Siguiente" para pasos: sólo
      // marcamos archivos que además manejan página/pageSize (paginación).
      const esPaginacion = /page(Size)?\b/i.test(src) && /totalPages/.test(src);
      if (!esPaginacion) continue;
      if (src.includes("PaginationControls")) continue;
      if (/>\s*(Anterior|Siguiente)\s*</.test(src)) violaciones.push(`  ${rel}`);
    }
    expect(
      violaciones,
      "Los listados paginados deben usar <PaginationControls> (o la prop\n" +
        "`pagination` de DataTable), no botones propios.\n\n" +
        violaciones.join("\n"),
    ).toEqual([]);
  });
});
