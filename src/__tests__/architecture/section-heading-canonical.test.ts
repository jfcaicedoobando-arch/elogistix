/**
 * Guardrail UI-06 — el título de un bloque de contenido es
 * `<SectionHeading />` (`src/components/shared/SectionHeading.tsx`), no un
 * `<h2>/<h3>/<h4>` con `font-semibold` a mano.
 *
 * Antes convivían al menos 6 escalas para el mismo rol tipográfico, así que el
 * mismo tipo de título se veía distinto entre módulos. Tras la migración de la
 * Ola UI-06 sólo quedan las excepciones declaradas abajo.
 *
 * Excluidos por directorio: `features/marketing` y `features/legal` — el sitio
 * público tiene su propia escala editorial (h2/h3 grandes) y no debe heredar la
 * tipografía densa del ERP.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/** `<h2|h3|h4 … className="…font-semibold…">` — con o sin clases adicionales. */
const RAW_HEADING = /<h[234]\b[^>]*className="[^"]*\bfont-semibold\b/;

/** Rutas (prefijo) fuera del contrato tipográfico del ERP. */
const EXCLUDED_PREFIXES: readonly string[] = [
  "src/features/marketing/",
  "src/features/legal/",
];

/**
 * Deuda declarada: encabezados de *estado* (vacío, error, elección de
 * organización), no títulos de sección. Su escala vive en el propio primitivo.
 * Sólo puede decrecer.
 */
const RAW_HEADING_DEBT: readonly string[] = [
  "src/components/empty/EmptyState.tsx",
  "src/components/shared/states/ErrorState.tsx",
  "src/components/shared/errorBoundary/ErrorBoundaryFallback.tsx",
  "src/components/layout/SeleccionaOrganizacion.tsx",
];

function tsxFiles(): string[] {
  return [
    ...walk(join(ROOT, "src"), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    }),
  ].filter((f) => f.endsWith(".tsx"));
}

describe("architecture — encabezados de sección canónicos (UI-06)", () => {
  it("ningún <hN> lleva font-semibold por className fuera de la deuda declarada", () => {
    const violations: string[] = [];
    for (const f of tsxFiles()) {
      const rel = relPath(ROOT, f);
      if (EXCLUDED_PREFIXES.some((p) => rel.startsWith(p))) continue;
      if (RAW_HEADING_DEBT.includes(rel)) continue;
      if (RAW_HEADING.test(readFileSync(f, "utf8"))) violations.push(rel);
    }
    expect(
      violations,
      `Encabezados con clases tipográficas a mano detectados. Usa\n` +
        `<SectionHeading> (variant="section" | "subsection" | "overline").\n\n` +
        violations.join("\n"),
    ).toEqual([]);
  });

  it("no hay entradas obsoletas en la deuda declarada", () => {
    const stale: string[] = [];
    for (const rel of RAW_HEADING_DEBT) {
      try {
        if (!RAW_HEADING.test(readFileSync(join(ROOT, rel), "utf8"))) stale.push(rel);
      } catch {
        stale.push(`${rel} (no existe)`);
      }
    }
    expect(
      stale,
      `Entradas en RAW_HEADING_DEBT que ya no aplican (o no existen).\n` +
        `Elimínalas de la lista.\n\n` +
        stale.join("\n"),
    ).toEqual([]);
  });
});
