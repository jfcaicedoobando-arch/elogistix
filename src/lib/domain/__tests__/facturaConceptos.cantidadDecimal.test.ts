/**
 * R170-08 · Contrato de cantidad decimal en conceptos de factura.
 *
 * El cliente ya normaliza cantidades fraccionarias (hasta 6 decimales, CFDI
 * 4.0) sin redondear a entero. La persistencia dependía de que la columna
 * `conceptos_factura.cantidad` deje de ser `integer` (migración preparada
 * `docs/migraciones-preparadas/20260913000500_r170_08_conceptos_factura_cantidad_decimal.sql`,
 * pendiente de autorización).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCantidadFiscal } from "@/lib/domain/facturaConceptos";

describe("R170-08 · cantidad decimal", () => {
  it("conserva 1.5 sin redondear ni truncar", () => {
    expect(parseCantidadFiscal(1.5)).toBe(1.5);
    expect(parseCantidadFiscal("1.5")).toBe(1.5);
  });

  it("conserva fracciones menores a 1 y rechaza cero/negativos vía fallback", () => {
    expect(parseCantidadFiscal(0.5)).toBe(0.5);
    expect(parseCantidadFiscal(0)).toBe(1);
    expect(parseCantidadFiscal(-3)).toBe(1);
  });

  it("la migración preparada convierte la columna a numeric y conserva positividad", () => {
    const sql = fs.readFileSync(
      path.join(
        process.cwd(),
        "docs/migraciones-preparadas/20260913000500_r170_08_conceptos_factura_cantidad_decimal.sql",
      ),
      "utf-8",
    );
    expect(sql).toMatch(/ALTER COLUMN cantidad TYPE numeric\(18, 6\)/);
    expect(sql).toMatch(/CHECK \(cantidad > 0\)/);
    expect(sql).not.toMatch(/round\(|trunc\(/i);
  });
});
