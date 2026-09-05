/**
 * B9 (v13.823.151): una proforma convertida a factura BORRADOR no debe
 * presentarse como "Facturada"/"emitida".
 */
import { describe, it, expect } from "vitest";
import {
  facturaEmitida,
  contarFacturasEmitidas,
  etiquetaProformaConvertida,
} from "../etiquetaCicloProforma";

describe("facturaEmitida", () => {
  it("descarta borradores y estados vacíos", () => {
    expect(facturaEmitida({ estado: "Borrador" })).toBe(false);
    expect(facturaEmitida({ estado: "borrador" })).toBe(false);
    expect(facturaEmitida({ estado: "" })).toBe(false);
    expect(facturaEmitida({ estado: null })).toBe(false);
  });

  it("acepta estados posteriores a la emisión", () => {
    expect(facturaEmitida({ estado: "Emitida" })).toBe(true);
    expect(facturaEmitida({ estado: "Pagada" })).toBe(true);
    expect(facturaEmitida({ estado: "Cancelada" })).toBe(true);
  });
});

describe("contarFacturasEmitidas", () => {
  it("cuenta sólo las emitidas", () => {
    expect(
      contarFacturasEmitidas([{ estado: "Borrador" }, { estado: "Emitida" }, { estado: "Pagada" }]),
    ).toBe(2);
  });
});

describe("etiquetaProformaConvertida", () => {
  it("usa 'Convertida a borrador' cuando todas las facturas son borrador", () => {
    expect(etiquetaProformaConvertida([{ estado: "Borrador" }])).toBe("Convertida a borrador");
  });

  it("usa 'Facturada' cuando hay al menos una emitida", () => {
    expect(etiquetaProformaConvertida([{ estado: "Borrador" }, { estado: "Emitida" }])).toBe(
      "Facturada",
    );
  });

  it("no oculta el estado cuando no se conocen facturas", () => {
    expect(etiquetaProformaConvertida([])).toBe("Facturada");
  });
});
