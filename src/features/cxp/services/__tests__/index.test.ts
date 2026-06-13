import { describe, it, expect } from "vitest";
import * as index from "../index";

describe("cxp index", () => {
  it("exporta funciones de proveedorFacturas", () => {
    expect(index.fetchFacturasCxP).toBeDefined();
  });
  it("exporta funciones de pagosProveedor", () => {
    expect(index.registrarPagoProveedor).toBeDefined();
  });
});
