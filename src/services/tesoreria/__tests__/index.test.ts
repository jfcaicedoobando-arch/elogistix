import { describe, it, expect } from "vitest";
import * as index from "../index";

describe("tesoreria index", () => {
  it("exporta funciones de conciliacion", () => {
    expect(index.importarMovimientos).toBeDefined();
  });
  it("exporta funciones de cuentas", () => {
    expect(index.listarCuentas).toBeDefined();
  });
});
