/**
 * PPD + "No objeto de impuesto" (SAT 01): Facturapi confirmó que el método de
 * pago es del CFDI completo y `taxability` es por concepto, así que la factura
 * SÍ se timbra. El diálogo sólo ADVIERTE que el complemento de pago del cobro
 * puede quedar pendiente; nunca bloquea ni cambia el tratamiento fiscal.
 */
import { describe, it, expect } from "vitest";
import { buildEstadoTimbrado } from "@/features/facturacion/utils/estadoTimbrado";
import { AVISO_NO_OBJETO_PPD_REP } from "@/lib/financial/noObjetoFiscal";

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
  it("permite timbrar la factura mixta y advierte por el REP", () => {
    const estado = buildEstadoTimbrado(factura, cliente, seleccion("PPD"), [
      { tipo_iva: "gravado_16" },
      { tipo_iva: "no_objeto" },
    ]);
    expect(estado.puedeTimbrar).toBe(true);
    expect(estado.checks.every((c) => c.ok)).toBe(true);
    expect(estado.advertencias).toEqual([AVISO_NO_OBJETO_PPD_REP]);
    // La advertencia debe verse: no se usa el camino rápido que la oculta.
    expect(estado.esFastPath).toBe(false);
  });

  it("la misma factura como PUE se timbra sin advertencias", () => {
    const estado = buildEstadoTimbrado(factura, cliente, seleccion("PUE"), [{ tipo_iva: "no_objeto" }]);
    expect(estado.puedeTimbrar).toBe(true);
    expect(estado.advertencias).toEqual([]);
    expect(estado.checks.every((c) => c.ok)).toBe(true);
  });

  it("una PPD sin conceptos no objeto no se ve afectada", () => {
    const estado = buildEstadoTimbrado(factura, cliente, seleccion("PPD"), [
      { tipo_iva: "gravado_16" },
      { tipo_iva: "exento" },
    ]);
    expect(estado.puedeTimbrar).toBe(true);
    expect(estado.advertencias).toEqual([]);
  });

  it("sin conceptos cargados no inventa advertencias", () => {
    const estado = buildEstadoTimbrado(factura, cliente, seleccion("PPD"));
    expect(estado.puedeTimbrar).toBe(true);
    expect(estado.advertencias).toEqual([]);
  });
});
