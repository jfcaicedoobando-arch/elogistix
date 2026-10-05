import { beforeEach, describe, expect, it, vi } from "vitest";
import { fechaFiscalFactura } from "@/features/profit/domain/fechaFiscalFactura";
import {
  mapFacturaRows, mapNotaCreditoRows, mapProveedorFacturaRows, mapProveedorNotaCreditoRows,
  type FacturaRow, type NotaCreditoRow, type ProveedorFacturaRow, type ProveedorNotaCreditoRow,
} from "@/lib/mappers/estadoResultadosRows";
import type { EmbarqueER } from "@/features/profit/domain/estadoResultados";

const datos = vi.hoisted(() => ({
  facturas: [] as FacturaRow[], ncs: [] as NotaCreditoRow[],
  pfacts: [] as ProveedorFacturaRow[], pncs: [] as ProveedorNotaCreditoRow[],
  embarques: [] as Array<EmbarqueER & { expediente: string }>,
}));
const fetches = vi.hoisted(() => ({
  facturas: vi.fn(), ncs: vi.fn(), pfacts: vi.fn(), pncs: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/features/catalogos/services", () => ({
  fetchExchangeRates: vi.fn(async () => ({ usdMxn: 18, eurMxn: 21 })),
  EXCHANGE_RATES_FALLBACK: { usdMxn: 17.25, eurMxn: 18.5 },
}));
vi.mock("../estadoResultadosFetch", () => ({
  fetchFacturasMes: fetches.facturas,
  fetchNotasCreditoMes: fetches.ncs,
  fetchProveedorFacturasMes: fetches.pfacts,
  fetchProveedorNotasCreditoMes: fetches.pncs,
  loadEmbarquesPorIds: async (ids: string[]) => datos.embarques.filter((e) => ids.includes(e.id)),
  loadEmbarquesPorExpedientes: async (exps: string[]) => new Map(
    datos.embarques.filter((e) => exps.includes(e.expediente)).map((e) => [e.expediente, e]),
  ),
  loadEmbarqueIdsPorFacturaProveedor: async (ids: string[]) => new Map(
    datos.pfacts.filter((pf) => ids.includes(pf.id) && pf.embarque_id)
      .map((pf) => [pf.id, pf.embarque_id!]),
  ),
}));
import { fetchEstadoResultadosDevengado, fetchEstadoResultadosDevengadoAnual } from "../estadoResultadosDevengado";

const enRango = (fecha: string, desde: string, hasta: string) => fecha >= desde && fecha <= hasta;
const params = { organizationId: "org-83", year: 2026 };

beforeEach(() => {
  vi.clearAllMocks();
  datos.facturas = []; datos.ncs = []; datos.pfacts = []; datos.pncs = []; datos.embarques = [];
  fetches.facturas.mockImplementation(async (_org, desde, hasta) => datos.facturas.filter((f) => enRango(fechaFiscalFactura(f), desde, hasta)));
  fetches.ncs.mockImplementation(async (_org, desde, hasta) => datos.ncs.filter((nc) => enRango(nc.fecha_emision, desde, hasta)));
  fetches.pfacts.mockImplementation(async (_org, desde, hasta) => datos.pfacts.filter((pf) => enRango(pf.fecha_emision, desde, hasta)));
  fetches.pncs.mockImplementation(async (_org, desde, hasta) => datos.pncs.filter((nc) => enRango(nc.fecha, desde, hasta)));
});

describe("AUD83: tendencia de Facturas y EERR mensual con el mismo criterio contable", () => {
  it("octubre conserva ingresos 251.11 y utilidad −2883.29, sin IVA ni NC brutas", async () => {
    datos.facturas = mapFacturaRows([{
      id: "a3", subtotal: 301.11, total: 349.29, moneda: "MXN", fecha_emision: "2026-10-03",
    }]);
    datos.ncs = mapNotaCreditoRows([{
      id: "nc1", folio: "NC1", factura_id: "a3", monto: 58, moneda: "MXN", fecha_emision: "2026-10-03",
      conceptos: [{ cantidad: 1, precio_unitario: 50, tipo_iva: "gravado_16", iva: 8 }],
    }]);
    datos.pfacts = mapProveedorFacturaRows([{
      id: "pf1", subtotal: 3134.40, total: 3635.90, moneda: "MXN", fecha_emision: "2026-10-04",
    }]);
    const anual = await fetchEstadoResultadosDevengadoAnual(params);
    expect(fetches.facturas).toHaveBeenCalledTimes(1);
    expect(fetches.pfacts).toHaveBeenCalledTimes(1);
    expect(fetches.ncs).toHaveBeenCalledTimes(1);
    expect(fetches.pncs).toHaveBeenCalledTimes(1);
    expect(fetches.ncs).toHaveBeenCalledWith("org-83", "2026-01-01", "2026-12-31");
    const mensual = await fetchEstadoResultadosDevengado({ ...params, month: 10 });
    const octubre = anual.find((fila) => fila.mes === 10)!;
    expect(octubre).toEqual({ mes: 10, ingresos_mxn: 251.11, costos_mxn: 3134.4 });
    expect(octubre.ingresos_mxn).toBe(mensual.totalIngresos.total);
    expect(octubre.costos_mxn).toBe(mensual.totalCostos.total);
    expect(octubre.ingresos_mxn - octubre.costos_mxn).toBeCloseTo(-2883.29, 2);
    expect(anual).toHaveLength(12);
    expect(anual.filter((fila) => fila.mes !== 10).every((fila) => fila.ingresos_mxn === 0 && fila.costos_mxn === 0)).toBe(true);
  });

  it("respeta el TC documental de factura, NC cliente, factura proveedor y NC proveedor", async () => {
    datos.embarques = [{ id: "emb1", expediente: "EXP1", modo: "Aéreo", tipo_cambio_usd: 15, tipo_cambio_eur: 23 }];
    datos.facturas = mapFacturaRows([{
      id: "usd", expediente: "EXP1", subtotal: 100, total: 116, moneda: "USD", tipo_cambio: 19, fecha_emision: "2026-10-02",
    }, {
      id: "eur", expediente: "EXP1", subtotal: 100, total: 116, moneda: "EUR", fecha_emision: "2026-10-02",
    }]);
    datos.ncs = mapNotaCreditoRows([{
      id: "nc-usd", factura_id: "usd", monto: 58, conceptos: [{ cantidad: 1, precio_unitario: 50 }],
      moneda: "USD", tipo_cambio: 21, fecha_emision: "2026-10-03",
    }]);
    datos.pfacts = mapProveedorFacturaRows([{
      id: "pf-usd", embarque_id: "emb1", subtotal: 100, total: 116, moneda: "USD", tipo_cambio_usd: 20, fecha_emision: "2026-10-02",
    }]);
    datos.pncs = mapProveedorNotaCreditoRows([{
      id: "pnc-usd", proveedor_factura_id: "pf-usd", monto: 50, moneda: "USD", tipo_cambio: 22, fecha: "2026-10-03",
    }]);
    const [octubre] = await fetchEstadoResultadosDevengadoAnual({ ...params, desdeMes: 10, hastaMes: 10 });
    const mensual = await fetchEstadoResultadosDevengado({ ...params, month: 10 });
    expect(octubre).toEqual({ mes: 10, ingresos_mxn: 3150, costos_mxn: 900 });
    expect(octubre.ingresos_mxn).toBe(mensual.totalIngresos.total);
    expect(octubre.costos_mxn).toBe(mensual.totalCostos.total);
  });

  it("reconoce por fecha fiscal MX y fecha de negocio de NC, sin moverlas por updated_at", async () => {
    datos.facturas = mapFacturaRows([{
      id: "septiembre", subtotal: 100, moneda: "MXN", fecha_emision: "2026-09-30", timbrado_en: "2026-10-01T05:59:59Z",
    }, {
      id: "octubre", subtotal: 200, moneda: "MXN", fecha_emision: "2026-09-25", timbrado_en: "2026-10-01T06:00:00Z",
    }]);
    datos.ncs = mapNotaCreditoRows([{
      id: "nc1", factura_id: "septiembre", monto: 58, moneda: "MXN", fecha_emision: "2026-09-30", updated_at: "2026-11-04",
      conceptos: [{ cantidad: 1, precio_unitario: 50 }],
    }]);
    const anual = await fetchEstadoResultadosDevengadoAnual(params);
    for (const month of [9, 10]) {
      const mensual = await fetchEstadoResultadosDevengado({ ...params, month });
      expect(anual[month - 1].ingresos_mxn).toBe(mensual.totalIngresos.total);
    }
    expect(anual[8].ingresos_mxn).toBe(50);
    expect(anual[9].ingresos_mxn).toBe(200);
    expect(anual[10].ingresos_mxn).toBe(0);
  });

  it("un rango entre años carga sólo los meses solicitados y conserva bloqueo de NC sin desglose", async () => {
    datos.facturas = mapFacturaRows([{ id: "a3", subtotal: 100, moneda: "MXN", fecha_emision: "2026-10-03" }]);
    datos.ncs = mapNotaCreditoRows([
      { id: "fuera", factura_id: "a3", folio: "NC fuera", monto: 58, moneda: "MXN", fecha_emision: "2026-11-03", conceptos: [] },
      { id: "dentro", factura_id: "a3", folio: "NC dentro", monto: 58, moneda: "MXN", fecha_emision: "2026-10-03", conceptos: [] },
    ]);
    await expect(fetchEstadoResultadosDevengadoAnual({ ...params, desdeMes: 10, hastaMes: 10 })).rejects.toMatchObject({
      notas: [{ id: "dentro", folio: "NC dentro" }],
    });
    expect(fetches.ncs).toHaveBeenCalledWith("org-83", "2026-10-01", "2026-10-31");
  });
});
