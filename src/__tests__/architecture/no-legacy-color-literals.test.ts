/**
 * Guardrail de arquitectura — prohíbe literales de color hardcoded de Tailwind
 * (paletas `slate/gray/zinc/red/green/yellow/orange/blue-*`) en `src/**`.
 *
 * El sistema de diseño usa tokens semánticos (`success`, `destructive`,
 * `warning`, `info`, `muted`, `primary`, etc.) definidos en `index.css`. Los
 * literales bypasean el theming y rompen dark mode + auditoría de cohesión
 * visual.
 *
 * Este test es la red de respaldo del contrato documentado en
 * `.lovable/plan.md` § "Contrato de tokens". Si aparece un literal nuevo
 * fuera de la allowlist, el CI falla.
 *
 * Cómo pedir excepción:
 *   1. Agregar el path relativo a `ALLOWLIST` (aquí abajo) con un comentario
 *      que explique por qué el literal aún no puede migrarse a token.
 *   2. Documentar la deuda en `.lovable/plan.md` (Lote 3B pendiente).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/**
 * Literales prohibidos:
 *   - text-{color}-{500..900}
 *   - bg-{color}-{50..300}
 *   - border-{color}-{500..900}
 *
 * Colores auditados: los paletas Tailwind más comunes que aparecen a mano
 * en el código (verde/rojo/amarillo/naranja/azul + neutros).
 */
const LITERAL_COLOR = /(?<![\w-])(?:text|bg|border|ring|from|to|via)-(?:red|green|yellow|orange|amber|emerald|lime|blue|sky|indigo|violet|purple|pink|rose|slate|gray|zinc|neutral|stone)-(?:50|100|200|300|400|500|600|700|800|900|950)(?![\w-])/;

/**
 * Archivos con deuda técnica documentada — el literal se debe migrar a token
 * en un lote posterior. Todo nuevo hallazgo debe agregarse aquí explícitamente
 * y documentarse en `.lovable/plan.md`.
 */
const ALLOWLIST: readonly string[] = [
  // Lote 3B (H1): escalera de aging con 4 rojos. Migrar a tokens `--aging-1..4`.
  "src/features/dashboard/finance/components/CobranzaBlock.tsx",
  // Lote 3B (M6 remanente): banners de revalidación de tarifa.
  "src/features/cotizacion/components/revalidacion/ReaprobacionTarifaBanner.tsx",
  "src/features/cotizacion/components/revalidacion/RevalidarTarifaModal.tsx",
  // Lote 3B (H3 remanente): BulkImportSteps mantiene 2 literales pendientes.
  "src/components/shared/BulkImportSteps.tsx",
  // Lote 3B (deuda P&L cotización): heatmap de márgenes usa emerald/red literales
  // en escala continua — requiere token gradiente antes de tokenizar.
  "src/features/cotizacion/components/ResumenPL.tsx",
  "src/features/cotizacion/components/SeccionCostosInternosPLDetalle.tsx",
  "src/features/cotizacion/components/SeccionCostosInternosPLLocal.tsx",
  "src/features/cotizacion/components/TablaCostosLocal.tsx",
  "src/features/cotizacion/components/wizard/WizardTotalsBar.tsx",
  // Lote 3B (CXP): NotasCreditoSection.
  "src/features/cxp/components/NotasCreditoSection.tsx",
  // Lote 3B (aging cartera): escala de 4 buckets (Corriente/1-30/31-60/+60).
  // Requiere tokens `--aging-1..4` como CobranzaBlock. Se migra junto con CobranzaBlock.
  "src/features/dashboard/direccion/components/CarteraSection.tsx",
  // Marketing/landing: preview interno del logo, no forma parte del ERP.
  // Se mantiene con paleta cruda intencionalmente.
  "src/features/marketing/routes/LogoPreview.tsx",
];

describe("architecture — no legacy tailwind color literals", () => {
  it("solo la allowlist puede usar literales de color (text/bg/border-{paleta}-{tono})", () => {
    const violations: { file: string; line: number; match: string }[] = [];

    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      const rel = relPath(ROOT, f);
      if (ALLOWLIST.includes(rel)) continue;

      const src = readFileSync(f, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(LITERAL_COLOR);
        if (m) violations.push({ file: rel, line: i + 1, match: m[0] });
      }
    }

    expect(
      violations,
      `Literales de color Tailwind detectados fuera de la allowlist.\n` +
        `Usa tokens semánticos (text-success, text-destructive, text-warning,\n` +
        `text-info, bg-muted, etc.) o agrega el archivo a ALLOWLIST en\n` +
        `src/__tests__/architecture/no-legacy-color-literals.test.ts.\n\n` +
        violations.map((v) => `  ${v.file}:${v.line} → ${v.match}`).join("\n"),
    ).toEqual([]);
  });

  it("no hay entradas obsoletas en la allowlist", () => {
    const stale: string[] = [];
    for (const rel of ALLOWLIST) {
      try {
        const src = readFileSync(join(ROOT, rel), "utf8");
        if (!LITERAL_COLOR.test(src)) stale.push(rel);
      } catch {
        stale.push(`${rel} (no existe)`);
      }
    }
    expect(
      stale,
      `Entradas en ALLOWLIST que ya no contienen literales (o no existen).\n` +
        `Elimínalas para mantener la allowlist mínima.\n\n` +
        stale.join("\n"),
    ).toEqual([]);
  });
});
