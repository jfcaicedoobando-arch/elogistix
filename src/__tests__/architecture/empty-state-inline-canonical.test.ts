/**
 * Guardrail UI-02 — un estado vacío dentro de una card, sección, celda o
 * popover se pinta con `<EmptyStateInline />`
 * (`src/components/empty/EmptyStateInline.tsx`), no con un `<div>/<p>` centrado
 * y texto gris a mano.
 *
 * Antes convivían tres paddings distintos (py-4/py-6/py-8) para el mismo rol
 * incluso dentro de un mismo feature. Tras la Ola UI-02 sólo quedan las
 * excepciones declaradas abajo, y la lista sólo puede decrecer.
 *
 * Fuera del contrato: `features/marketing` y `features/legal` (escala editorial
 * propia), los PDFs (`src/pdf`, otros primitivos) y los tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/**
 * `<div|p … className="… text-center|text-muted-foreground …"> No hay …`
 * Detecta el texto de vacío *como contenido JSX*, no como prop (`message=`,
 * `emptyMessage=`, `title=`), que ya viaja por un primitivo canónico.
 */
const RAW_EMPTY =
  /<(div|p)\b[^>]*className="[^"]*(text-center|text-muted-foreground)[^"]*"[^>]*>\s*\n?\s*\{?[^<>{}]{0,60}?(No hay|Aún no|Sin resultados|Sin movimientos|Sin datos|No se encontr)/;

const EXCLUDED_PREFIXES: readonly string[] = [
  "src/features/marketing/",
  "src/features/legal/",
  "src/pdf/",
];

/**
 * Deuda declarada — sólo puede decrecer.
 * `DashboardEjecutivoFacturacionMiniSerie`: el "Sin datos" vive dentro de un
 * sparkline de 24px de alto; `EmptyStateInline` (icono + texto centrado) no cabe
 * en ese espacio.
 */
const RAW_EMPTY_DEBT: readonly string[] = [
  "src/features/facturacion/components/DashboardEjecutivoFacturacionMiniSerie.tsx",
];


function tsxFiles(): string[] {
  return walk(join(ROOT, "src"), {
    excludeDirs: ["__tests__", "node_modules"],
    excludeFileRe: /\.(test|spec)\.tsx?$/,
  }).filter((f) => f.endsWith(".tsx"));
}

describe("architecture — estados vacíos inline canónicos (UI-02)", () => {
  it("ningún bloque centrado pinta un estado vacío a mano fuera de la deuda declarada", () => {
    const violations: string[] = [];
    for (const f of tsxFiles()) {
      const rel = relPath(ROOT, f);
      if (EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) continue;
      if (RAW_EMPTY_DEBT.includes(rel)) continue;
      if (RAW_EMPTY.test(readFileSync(f, "utf8"))) violations.push(rel);
    }
    expect(
      violations,
      `Estados vacíos pintados a mano detectados. Usa\n` +
        `<EmptyStateInline icon message hint action density /> ` +
        `(o <ErrorStateInline /> si es un error).\n\n` +
        violations.join("\n"),
    ).toEqual([]);
  });

  it("no hay entradas obsoletas en la deuda de estados vacíos", () => {
    const stale: string[] = [];
    for (const rel of RAW_EMPTY_DEBT) {
      try {
        if (!RAW_EMPTY.test(readFileSync(join(ROOT, rel), "utf8"))) stale.push(rel);
      } catch {
        stale.push(`${rel} (no existe)`);
      }
    }
    expect(
      stale,
      `Entradas en RAW_EMPTY_DEBT que ya no aplican (o no existen).\n` +
        `Elimínalas de la lista.\n\n` +
        stale.join("\n"),
    ).toEqual([]);
  });
});
