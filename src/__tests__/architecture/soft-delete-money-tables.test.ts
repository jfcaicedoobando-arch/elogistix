/**
 * Guardrail M6 (auditoría arquitectura 2026-07-29): las tablas de dinero con
 * soft-delete deben leerse SIEMPRE con `.is("deleted_at", null)`.
 *
 * El bug que motiva este test: el frontend filtraba por `deleted_at` en
 * `comisiones_devengadas` y `embarque_garantias_contenedor` antes de que la
 * columna existiera en la base (error 42703 en runtime). Este test ancla el
 * contrato de las lecturas para que no se pierda el filtro en refactors.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..", "..");

/** archivo → tabla que debe filtrarse */
const CASOS: Array<{ file: string; tabla: string; minOcurrencias: number }> = [
  {
    file: "src/features/embarques/services/garantias.ts",
    tabla: "embarque_garantias_contenedor",
    minOcurrencias: 1,
  },
  {
    file: "src/features/comisiones/services/devengadas.ts",
    tabla: "comisiones_devengadas",
    minOcurrencias: 1,
  },
  {
    // v13.777.7 — `conciliarConPago` salió a conciliacionVincular.ts (límite de
    // 200 líneas): aquí quedan la deduplicación de importación y el listado.
    file: "src/features/tesoreria/services/conciliacion.ts",
    tabla: "bbva_movimientos",
    minOcurrencias: 2,
  },
  {
    file: "src/features/tesoreria/services/conciliacionVincular.ts",
    tabla: "bbva_movimientos",
    minOcurrencias: 2,
  },
  {
    // desconciliar/ignorar salieron a este archivo por el límite de 200 líneas.
    file: "src/features/tesoreria/services/conciliacionEstados.ts",
    tabla: "bbva_movimientos",
    minOcurrencias: 2,
  },

  {
    file: "src/features/proveedor/services/proveedoresCrud.ts",
    tabla: "proveedores",
    minOcurrencias: 3,
  },
];

function contarFiltros(src: string): number {
  return (src.match(/\.is\(\s*["']deleted_at["']\s*,\s*null\s*\)/g) ?? []).length;
}

describe("M6: soft-delete en tablas de dinero", () => {
  it.each(CASOS)(
    "$file filtra registros borrados de $tabla",
    ({ file, tabla, minOcurrencias }) => {
      const src = readFileSync(path.join(ROOT, file), "utf-8");
      expect(src).toContain(tabla);
      expect(
        contarFiltros(src),
        `${file} debe tener al menos ${minOcurrencias} filtros .is("deleted_at", null)`,
      ).toBeGreaterThanOrEqual(minOcurrencias);
    },
  );

  it("deleteProveedor es soft-delete (no hard .delete())", () => {
    const src = readFileSync(
      path.join(ROOT, "src/features/proveedor/services/proveedoresCrud.ts"),
      "utf-8",
    );
    const fn = src.slice(src.indexOf("export async function deleteProveedor"));
    const cuerpo = fn.slice(0, fn.indexOf("\n}"));
    expect(cuerpo).toContain("deleted_at");
    expect(cuerpo).not.toMatch(/\.delete\(\)/);
  });

  /**
   * v13.444.1 — El borrado de movimientos manuales de conciliación es lógico:
   * marca `deleted_at` en lugar de `.delete()`, y el listado ya filtra borrados.
   * El conteo del dashboard vive en la función SQL `conciliacion_resumen`, que
   * también filtra `deleted_at IS NULL` (migración 2026-08-06).
   */
  it("eliminarMovimientoManual es soft-delete", () => {
    const src = readFileSync(
      path.join(ROOT, "src/features/tesoreria/services/conciliacionManual.ts"),
      "utf-8",
    );
    const fn = src.slice(src.indexOf("export async function eliminarMovimientoManual"));
    const cuerpo = fn.slice(0, fn.indexOf("\n}"));
    expect(cuerpo).toContain("deleted_at");
    expect(cuerpo).not.toMatch(/\.delete\(\)/);
  });
});
