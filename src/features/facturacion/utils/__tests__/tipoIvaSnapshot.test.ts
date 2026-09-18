/**
 * P2-IVA — El detalle de factura lee el tratamiento exacto del snapshot y dice
 * "no disponible" (null) cuando el snapshot no alcanza.
 */
import { describe, it, expect } from "vitest";
import { tipoIvaDesdeSnapshot } from "../tipoIvaSnapshot";

const conTaxes = (taxes: Record<string, unknown>[]) => ({ product: { taxes } });

describe("tipoIvaDesdeSnapshot", () => {
  it("respeta el tipo explícito guardado", () => {
    expect(tipoIvaDesdeSnapshot({ tipo_iva: "no_objeto" })).toBe("no_objeto");
    expect(tipoIvaDesdeSnapshot({ tipo_iva: "gravado_8" })).toBe("gravado_8");
  });

  it("lee ObjetoImp 01 desde taxability", () => {
    expect(tipoIvaDesdeSnapshot({ product: { taxability: "01" } })).toBe("no_objeto");
    expect(tipoIvaDesdeSnapshot({ taxability: "01" })).toBe("no_objeto");
  });

  it("distingue 8% de 16% con la tasa exacta", () => {
    expect(tipoIvaDesdeSnapshot(conTaxes([{ type: "IVA", rate: 0.08 }]))).toBe("gravado_8");
    expect(tipoIvaDesdeSnapshot(conTaxes([{ type: "IVA", rate: 0.16 }]))).toBe("gravado_16");
  });

  it("distingue tasa 0% de exento por el factor", () => {
    expect(tipoIvaDesdeSnapshot(conTaxes([{ type: "IVA", rate: 0 }]))).toBe("tasa_0");
    expect(
      tipoIvaDesdeSnapshot(conTaxes([{ type: "IVA", rate: 0, factor: "Exento" }])),
    ).toBe("exento");
  });

  it("ignora retenciones: un renglón con sólo retenciones no es traslado", () => {
    expect(
      tipoIvaDesdeSnapshot(
        conTaxes([
          { type: "ISR", rate: 0.1, withholding: true },
          { type: "IVA", rate: 0.04, withholding: true },
        ]),
      ),
    ).toBeNull();
  });

  it("no inventa tratamiento cuando el snapshot no alcanza", () => {
    expect(tipoIvaDesdeSnapshot({})).toBeNull();
    expect(tipoIvaDesdeSnapshot(conTaxes([]))).toBeNull();
    expect(tipoIvaDesdeSnapshot(conTaxes([{ type: "IVA", rate: 0.11 }]))).toBeNull();
  });
});
