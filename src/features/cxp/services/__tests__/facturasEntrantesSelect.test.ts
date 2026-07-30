import { describe, expect, it } from "vitest";
import { SELECT_COLS_ENTRANTES } from "../facturasEntrantes.types";

/**
 * Regresión: la tabla `proveedores` NO tiene columna `origen`; la columna real
 * es `origen_proveedor`. Un select con `origen` rompe el buzón de facturas
 * entrantes con el error 42703 de Postgres.
 */
describe("SELECT_COLS_ENTRANTES", () => {
  it("pide origen_proveedor en el embed de proveedores", () => {
    expect(SELECT_COLS_ENTRANTES).toContain(
      "proveedores:proveedor_id(nombre, origen_proveedor)",
    );
  });

  it("no pide una columna `origen` suelta en proveedores", () => {
    expect(SELECT_COLS_ENTRANTES).not.toMatch(/proveedores:proveedor_id\([^)]*\borigen\b[^_]/);
  });
});
