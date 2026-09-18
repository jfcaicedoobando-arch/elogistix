/**
 * P1 · Auditoría IVA — El diálogo de timbrado avisa antes de emitir una PPD con
 * conceptos "No objeto de impuesto" (SAT 01), porque su cobro se quedaría sin
 * complemento de pago. El servidor sigue siendo la autoridad.
 */
import { describe, it, expect } from "vitest";
import { buildEstadoTimbrado } from "@/features/facturacion/utils/estadoTimbrado";
import { MSG_NO_OBJETO_PPD } from "@/lib/financial/noObjetoFiscal";

const factura = {
  rfc_cliente: "AAA010101AAA",
  moneda: "MXN",
  tipo_cambio: 1,
  uso_cfdi: "G03",
  forma_pago: "03",
  metodo_pago: "PUE",
};
const cliente = { rfc: "AAA010101AAA", codigo_postal: "06600", regimen_fiscal: "601" };
const seleccion = (metodoPago: string) => ({ usoCfdi: "G03", formaPago: "03", metodoPago });

describe("buildEstadoTimbrado — PPD con No objeto", () => {
  it("bloquea el timbrado y explica la razón", () => {
    const estado = buildEstadoTimbrado(factura, cliente, seleccion("PPD"), [
      { tipo_iva: "gravado_16" },
      { tipo_iva: "no_objeto" },
    ]);
    expect(estado.puedeTimbrar).toBe(false);
    expect(estado.esFastPath).toBe(false);
    expect(estado.checks.some((c) => !c.ok && c.label === MSG_NO_OBJETO_PPD)).toBe(true);
  });

  it("la misma factura como PUE sí puede timbrarse", () => {
    const estado = buildEstadoTimbrado(factura, cliente, seleccion("PUE"), [{ tipo_iva: "no_objeto" }]);
    expect(estado.puedeTimbrar).toBe(true);
    expect(estado.checks.every((c) => c.ok)).toBe(true);
  });

  it("una PPD sin conceptos no objeto no se ve afectada", () => {
    const estado = buildEstadoTimbrado(factura, cliente, seleccion("PPD"), [
      { tipo_iva: "gravado_16" },
      { tipo_iva: "exento" },
    ]);
    expect(estado.puedeTimbrar).toBe(true);
  });

  it("sin conceptos cargados no inventa el bloqueo", () => {
    expect(buildEstadoTimbrado(factura, cliente, seleccion("PPD")).puedeTimbrar).toBe(true);
  });
});
