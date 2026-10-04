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

  it.each([null, [], [{ cantidad: 1 }], [{ cantidad: 0, precio_unitario: 50 }], [{ cantidad: 1, precio_unitario: "" }], [{ cantidad: 1, precio_unitario: -50 }], [{ cantidad: 1e308, precio_unitario: 1e308 }], [{ cantidad: 1, precio_unitario: 1e306 }, { cantidad: 1, precio_unitario: 1e306 }]].map(conceptos => ({ conceptos })))("bloquea un reporte sin desglose válido ($conceptos)", ({ conceptos }) => {
    expect(baseNotaCreditoSinImpuestos(conceptos)).toBeNull();
    expect(() => ingresosDeNotas(mapNotaCreditoRows([{ factura_id: "legacy", monto: 58, moneda: "MXN", conceptos }]), bucket(), tc)).toThrow(NotaCreditoSinDesgloseError);
  });
});
