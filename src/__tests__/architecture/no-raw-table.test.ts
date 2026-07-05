/**
 * Guardrail de arquitectura — `@/components/ui/table` (primitiva shadcn) sólo
 * puede importarse desde archivos de la allowlist. El resto debe usar
 * `<DataTable />` + `columnBuilders`/`defineColumns` para mantener un único
 * design language en toda la app.
 *
 * Este test es la RED DE RESPALDO del bloque `no-raw-table` en
 * `eslint.config.js`. Si alguien relaja la regla de ESLint sin actualizar la
 * allowlist, este test falla en CI.
 *
 * Cómo pedir excepción:
 *   1. Agregar el path relativo a `ALLOWLIST` (aquí abajo) con un comentario.
 *   2. Agregar el mismo path al bloque `no-raw-table` en `eslint.config.js`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");
const RAW_TABLE_IMPORT = /from\s+["']@\/components\/ui\/table["']/;

/** Archivos autorizados a importar `@/components/ui/table` directamente. */
const ALLOWLIST: readonly string[] = [
  // Implementación misma del DataTable — consume las primitivas.
  "src/components/shared/DataTable.tsx",
  "src/components/shared/dataTable/DataTableBody.tsx",
  "src/components/shared/dataTable/DataTableHeaderRow.tsx",
  // Form-tables editables con render row complejo (inputs/textareas por celda).
  "src/features/cotizacion/components/SeccionMercanciaAerea.tsx",
  "src/features/cotizacion/components/SeccionMercanciaMaritimaLCL.tsx",
  "src/features/cotizacion/components/TablaConceptosGenerico.tsx",
  "src/features/cotizacion/components/TablaCostosDetalle.tsx",
  "src/features/facturacion/components/detalle/FacturaConceptosTable.tsx",
  "src/features/portal/components/factura/PortalFacturaConceptosTable.tsx",
  "src/features/costeo/components/DemorasTarifaEditor.tsx",
  // Sub-tablas read-only estáticas (sin sort/paginación).
  "src/features/cotizacion/components/seccionMercancia/DimensionesLCLTable.tsx",
  "src/features/cotizacion/components/seccionMercancia/DimensionesAereasTable.tsx",
  "src/features/embarques/components/tabResumen/EmbarquesRelacionadosCard.tsx",
  "src/features/embarques/components/pnl/PnlProveedoresTable.tsx",
  "src/features/embarques/components/pnl/PnlComparativaTable.tsx",
  // Catálogos con toggles inline por fila.
  "src/features/configuracion/components/CatalogoClavesSATCard.tsx",
  "src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx",
];

describe("architecture — no raw @/components/ui/table imports", () => {
  it("solo la allowlist puede importar @/components/ui/table", () => {
    const violations: string[] = [];
    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      const src = readFileSync(f, "utf8");
      if (!RAW_TABLE_IMPORT.test(src)) continue;
      const rel = relPath(ROOT, f);
      if (!ALLOWLIST.includes(rel)) violations.push(rel);
    }
    expect(
      violations,
      `Archivos que importan @/components/ui/table fuera de la allowlist.\n` +
        `Usa <DataTable /> + columnBuilders o agrégalos a ALLOWLIST en\n` +
        `src/__tests__/architecture/no-raw-table.test.ts y a eslint.config.js.\n\n` +
        violations.join("\n"),
    ).toEqual([]);
  });

  it("no hay entradas obsoletas en la allowlist", () => {
    const stale: string[] = [];
    for (const rel of ALLOWLIST) {
      try {
        const src = readFileSync(join(ROOT, rel), "utf8");
        if (!RAW_TABLE_IMPORT.test(src)) stale.push(rel);
      } catch {
        stale.push(`${rel} (no existe)`);
      }
    }
    expect(
      stale,
      `Entradas en ALLOWLIST que ya no importan @/components/ui/table (o no existen).\n` +
        `Elimínalas de ALLOWLIST y de eslint.config.js.\n\n` +
        stale.join("\n"),
    ).toEqual([]);
  });
});
