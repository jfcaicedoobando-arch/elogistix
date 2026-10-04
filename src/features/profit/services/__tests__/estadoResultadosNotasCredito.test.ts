import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { baseNotaCreditoSinImpuestos, NotaCreditoSinDesgloseError } from "@/lib/financial/baseNotaCredito";
import { mapNotaCreditoRows } from "@/lib/mappers/estadoResultadosRows";
import { ingresosDeNotas, type VentasBucket } from "../estadoResultadosBuckets";
import { buildEstadoResultados } from "@/features/profit/domain/estadoResultados";
import { buildEstadoResultadosCsvRows } from "@/features/profit/components/EstadoResultadosTable.helpers";

const tc = { usd: 20, eur: 22 };
const bucket = (): VentasBucket => ({ embarques: [], ventas: [] });

describe("AUD33: notas de crédito en EERR sin impuestos", () => {
  it.each(["gravado_16", "tasa_0", "exento", "no_objeto"])("conserva la base persistida de %s sin inferir impuestos", (tipo_iva) => {
    expect(baseNotaCreditoSinImpuestos([{ cantidad: 2.5, precio_unitario: 20, tipo_iva, iva: 8, retencion_iva: 2 }])).toBe(50);
  });

  it("redondea cada línea antes de sumar, conserva decimales y no usa el monto bruto", () => {
    expect(baseNotaCreditoSinImpuestos([{ cantidad: "0.3", precio_unitario: "0.11" }, { cantidad: 1, precio_unitario: 0.005 }])).toBe(0.04);
    const out = bucket();
    ingresosDeNotas(mapNotaCreditoRows([{ factura_id: "a3", monto: 58, moneda: "MXN", conceptos: [{ cantidad: 1, precio_unitario: 50 }] }]), out, tc);
    const data = buildEstadoResultados(
      [...out.embarques, { id: "facturas", modo: "Otros", tipo_cambio_usd: 20, tipo_cambio_eur: 22 }],
      [...out.ventas, { embarque_id: "facturas", descripcion: "Facturación", moneda: "MXN", total: 200.11 }],
      [{ embarque_id: "facturas", concepto: "Costos", moneda: "MXN", monto: 2000 }],
    );
    expect(data.totalIngresos.total).toBe(150.11);
    expect(data.utilidad.total).toBeCloseTo(-1849.89, 2);
    const csv = buildEstadoResultadosCsvRows(data);
    expect(csv.find(row => row.concepto === "TOTAL INGRESOS")?.total).toBe("150.11");
    expect(csv.find(row => row.concepto === "UTILIDAD BRUTA")?.total).toBe("-1849.89");
  });

  it("conserva moneda y TC documental al descontar la base de una NC USD", () => {
    const out = bucket();
    ingresosDeNotas(mapNotaCreditoRows([{ factura_id: "usd", monto: 58, moneda: "USD", tipo_cambio: 21, conceptos: [{ cantidad: 1, precio_unitario: 50 }] }]), out, tc);
    expect(buildEstadoResultados(out.embarques, out.ventas, []).totalIngresos.total).toBe(-1050);
  });

  it("varias NC de una factura conservan cada TC documental", () => {
    const out = bucket();
    ingresosDeNotas(mapNotaCreditoRows([
      { factura_id: "usd", monto: 58, moneda: "USD", tipo_cambio: 20, conceptos: [{ cantidad: 1, precio_unitario: 50 }] },
      { factura_id: "usd", monto: 58, moneda: "USD", tipo_cambio: 21, conceptos: [{ cantidad: 1, precio_unitario: 50 }] },
    ]), out, tc);
    expect(buildEstadoResultados(out.embarques, out.ventas, []).totalIngresos.total).toBe(-2050);
  });

  it("NC1 con su JSON persistido conserva base 50 e identificación, sin bloquear por IVA 8", () => {
    const [nc] = mapNotaCreditoRows([{
      id: "42b98b51-9e87-4cdb-8b07-91a259b774ff", folio: "NC1", factura_id: "a3",
      monto: 58, moneda: "MXN", fecha_emision: "2026-10-03", estado: "Timbrada",
      conceptos: [{ cantidad: 1, precio_unitario: 50, tasa_iva: 0.16, tipo_iva: "gravado_16", tasa_retencion: 0 }],
    }]);
    expect(nc).toMatchObject({ id: "42b98b51-9e87-4cdb-8b07-91a259b774ff", folio: "NC1", subtotal: 50, monto: 58 });
    const out = bucket();
    expect(() => ingresosDeNotas([nc], out, tc)).not.toThrow();
    expect(buildEstadoResultados(out.embarques, out.ventas, []).totalIngresos.total).toBe(-50);
  });

  it("identifica todas las NC inválidas sin agregar previamente una NC válida", () => {
    const out = bucket();
    const ncs = mapNotaCreditoRows([
      { id: "valida", folio: "NC1", factura_id: "a3", monto: 58, moneda: "MXN", conceptos: [{ cantidad: 1, precio_unitario: 50 }] },
      { id: "sin-conceptos", folio: "NC2", factura_id: "a3", monto: 58, moneda: "MXN", conceptos: [] },
      { id: "precio-ausente", folio: null, factura_id: "a3", monto: 116, moneda: "MXN", conceptos: [{ cantidad: 1 }] },
    ]);
    let error: unknown;
    try { ingresosDeNotas(ncs, out, tc); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(NotaCreditoSinDesgloseError);
    expect(error).toMatchObject({ notas: [{ id: "sin-conceptos", folio: "NC2" }, { id: "precio-ausente", folio: null }] });
    expect(String(error)).toContain("NC2 (ID: sin-conceptos)");
    expect(String(error)).toContain("Sin folio (ID: precio-ausente)");
    expect(String(error)).not.toContain("NC1");
    expect(out).toEqual(bucket());
  });

  it.each([null, [], [{ cantidad: 1 }], [{ cantidad: 0, precio_unitario: 50 }], [{ cantidad: 1, precio_unitario: "" }], [{ cantidad: 1, precio_unitario: -50 }], [{ cantidad: 1e308, precio_unitario: 1e308 }], [{ cantidad: 1, precio_unitario: 1e306 }, { cantidad: 1, precio_unitario: 1e306 }]].map(conceptos => ({ conceptos })))("bloquea un reporte sin desglose válido ($conceptos)", ({ conceptos }) => {
    expect(baseNotaCreditoSinImpuestos(conceptos)).toBeNull();
    expect(() => ingresosDeNotas(mapNotaCreditoRows([{ factura_id: "legacy", monto: 58, moneda: "MXN", conceptos }]), bucket(), tc)).toThrow(NotaCreditoSinDesgloseError);
  });
});
