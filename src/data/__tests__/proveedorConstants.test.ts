import { describe, it, expect } from "vitest";
import { TIPOS_PROVEEDOR, MONEDAS_PROVEEDOR, PAISES_PROVEEDOR } from "@/data/proveedorConstants";

describe("proveedorConstants", () => {
  it("TIPOS_PROVEEDOR no está vacío", () => {
    expect(TIPOS_PROVEEDOR.length).toBeGreaterThan(0);
  });
  it("MONEDAS_PROVEEDOR contiene MXN, USD, EUR", () => {
    expect(MONEDAS_PROVEEDOR).toEqual(expect.arrayContaining(["MXN", "USD", "EUR"]));
  });
  it("PAISES_PROVEEDOR incluye México", () => {
    expect(PAISES_PROVEEDOR).toContain("México");
  });
});
