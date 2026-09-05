/**
 * Guardrail de arquitectura — Ninguna columna de tabla (archivos `*columns.tsx`
 * / `*Columns.tsx`) puede importar `Link` de `react-router-dom`.
 *
 * Rationale: las tablas de la app estandarizan drilldown vía `getRowHref` en
 * `<DataTable />` (fila entera navegable, con soporte de teclado y Ctrl+click).
 * Los `<Link>` inline en celdas rompen el patrón (dos targets de navegación
 * por fila, tap targets pequeños, accesibilidad inconsistente).
 *
 * Cómo pedir excepción:
 *   1. Agregar el path relativo a `ALLOWLIST` con un comentario que explique
 *      por qué el `<Link>` inline es necesario.
 *   2. Asegurarse de que el `<Link>` NO sea el drilldown principal de la fila
 *      (para eso está `getRowHref`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/** Detecta `import { ..., Link, ... } from "react-router-dom"`. */
const LINK_IMPORT_RE =
  /import\s*(?:type\s*)?\{[^}]*\bLink\b[^}]*\}\s*from\s*["']react-router-dom["']/;

/** Archivos autorizados a importar `Link` en columnas (excepciones justificadas). */
const ALLOWLIST: readonly string[] = [
  // v13.490.0 — Cartera tiene selección múltiple para el cobro en lote: con
  // filas marcadas la fila deja de navegar (modo selección) y el folio es la
  // única vía explícita al detalle. `getRowHref` sigue siendo el drilldown
  // cuando no hay selección activa.
  // v13.491.0 — la celda de folio se movió a este archivo al dividir
  // carteraColumns.tsx (Power of 10: ≤ 200 líneas).
  "src/features/bandejas/routes/_sections/carteraColumns.selection.tsx",
  // v13.823.150 — Proformas: el drilldown de la fila es la PROFORMA. El
  // expediente enlaza al EMBARQUE vinculado (destino distinto), así que no
  // puede resolverse con `getRowHref`; detiene la propagación del click.
  "src/features/facturacion/components/proformasColumns.tsx",
];


const isColumnFile = (rel: string) =>
  /columns\.tsx$/i.test(rel) && !/\.test\.tsx?$/i.test(rel);

describe("architecture — no <Link> inline en columnas de tabla", () => {
  it("ningún archivo *columns.tsx importa Link de react-router-dom", () => {
    const violations: string[] = [];
    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
    })) {
      const rel = relPath(ROOT, f);
      if (!isColumnFile(rel)) continue;
      if (ALLOWLIST.includes(rel)) continue;
      const src = readFileSync(f, "utf8");
      if (LINK_IMPORT_RE.test(src)) violations.push(rel);
    }
    expect(
      violations,
      `Archivos *columns.tsx que importan Link de react-router-dom.\n` +
        `Usa getRowHref en <DataTable /> para el drilldown de la fila, o\n` +
        `agrega el archivo a ALLOWLIST en\n` +
        `src/__tests__/architecture/tables-no-inline-links.test.ts con justificación.\n\n` +
        violations.join("\n"),
    ).toEqual([]);
  });

  it("allowlist de tables-no-inline-links no tiene entradas obsoletas", () => {
    const stale: string[] = [];
    for (const rel of ALLOWLIST) {
      try {
        const src = readFileSync(join(ROOT, rel), "utf8");
        if (!LINK_IMPORT_RE.test(src)) stale.push(rel);
      } catch {
        stale.push(`${rel} (no existe)`);
      }
    }
    expect(
      stale,
      `Entradas en ALLOWLIST que ya no importan Link.\n\n` + stale.join("\n"),
    ).toEqual([]);
  });
});
