import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchClienteFinancials } from "../financials";
import { fetchEstadoCuenta } from "@/features/facturacion/estadoCuenta/services/estadoCuenta";
import { fetchEstadoCuentaFacturas, toEstadoCuentaFacturas } from "@/features/facturacion/services/exports";
import type { RawFactura, RawNota } from "@/features/facturacion/estadoCuenta/services/estadoCuentaTypes";

function nota(overrides: Partial<RawNota> = {}): RawNota {
  return { id: "nc", folio: "NC-QA", fecha_emision: "2026-10-01", monto: 58, moneda: "USD", tipo_cambio: 20,
    estado: "Aplicada", deleted_at: null, ...overrides };
}
function factura(overrides: Partial<RawFactura> = {}): RawFactura {
  return { id: "f", numero: "NC-QA", cliente_id: "c", cliente_nombre: "Prueba",
    expediente: "E", moneda: "MXN", total: 1160, tipo_cambio: 1, estado: "Pagada",
    fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-10",
    pagos_factura: [], factura_notas_credito: [nota()], ...overrides };
}
function responder(f: RawFactura) {
  mock.setTableResult("facturas", { data: [f], error: null });
}

beforeEach(() => {
  mock.resetResults();
  mock.tableCalls.length = 0;
  mock.setRpcResult("profit_por_cliente", { data: [], error: null });
});

describe("hallazgo 48: NC multimoneda en KPI, tabla/CSV y PDF", () => {
  it.each(["Timbrada", "Aplicada"])("fixture ola1: MXN 1160 menos USD 58 @20 (%s) queda saldada", async (estado) => {
    // Copia sintética del caso, sin ejecutar ni modificar el fixture SQL histórico.
    responder(factura({ factura_notas_credito: [nota({ estado })] }));
    const kpi = await fetchClienteFinancials("c");
    const tabla = await fetchEstadoCuenta({ clienteIds: ["c"] });
    expect(kpi).toMatchObject({ facturadoMXN: 1160, pendienteMXN: 0 });
    expect(tabla[0]).toMatchObject({ saldo: 0, notas_credito_aplicadas: 1160 });
    expect(tabla[0].notas_credito[0].monto).toBe(1160);
    expect(toEstadoCuentaFacturas(tabla)[0].saldo).toBe(0);
    expect(await fetchEstadoCuentaFacturas("c")).toEqual([]);
    const select = String(mock.tableCalls[0].opArgs[0][0]);
    expect(select).toContain("monto, moneda, tipo_cambio, estado");
  });

  it.each(["Timbrada", "Aplicada"])("USD 100 con NC MXN 1160 %s usa TC histórico de factura, no TC de NC", async (estado) => {
    responder(factura({ moneda: "USD", tipo_cambio: 20, total: 100, estado: "Parcialmente pagada",
      factura_notas_credito: [nota({ estado, moneda: "MXN", monto: 1160, tipo_cambio: 99 })] }));
    expect((await fetchClienteFinancials("c")).pendienteMXN).toBe(840);
    const tabla = await fetchEstadoCuenta({ clienteIds: ["c"] });
    expect(tabla[0]).toMatchObject({ saldo: 42, notas_credito_aplicadas: 58 });
    expect(tabla[0].notas_credito[0].monto).toBe(58);
    expect((await fetchEstadoCuentaFacturas("c"))[0]).toMatchObject({ moneda: "USD", saldo: 42 });
  });

  it("no descuenta NC canceladas/borradas, incluso si cubrían el total", async () => {
    responder(factura({ estado: "Emitida", factura_notas_credito: [
      nota({ id: "vigente", monto: 29 }), // MXN 580 vigente.
      nota({ id: "cancelada", estado: "Cancelada" }),
      nota({ id: "borrada", deleted_at: "2026-10-02" }),
      nota({ id: "borrador", estado: "Borrador", moneda: "EUR", tipo_cambio: null }),
    ] }));
    expect((await fetchClienteFinancials("c")).pendienteMXN).toBe(580);
    expect((await fetchEstadoCuentaFacturas("c"))[0].saldo).toBe(580);
    responder(factura({ estado: "Emitida", factura_notas_credito: [nota({ estado: "Cancelada" })] }));
    expect((await fetchClienteFinancials("c")).pendienteMXN).toBe(1160);
  });

  it("agrega NC convertidas antes de redondear centavos", async () => {
    responder(factura({ moneda: "USD", tipo_cambio: 3, total: 1,
      factura_notas_credito: [1, 2, 3].map((id) => nota({ id: String(id), moneda: "MXN", monto: 1 })) }));
    expect((await fetchClienteFinancials("c")).pendienteMXN).toBe(0);
    expect(await fetchEstadoCuentaFacturas("c")).toEqual([]);
  });

  it("no publica deuda mezclada si una NC EUR vigente no tiene TC histórico", async () => {
    responder(factura({ factura_notas_credito: [nota({ moneda: "EUR", tipo_cambio: null })] }));
    await expect(fetchClienteFinancials("c")).rejects.toThrow("LC_NC_MONEDA_SIN_TC");
    await expect(fetchEstadoCuentaFacturas("c")).rejects.toThrow("LC_NC_MONEDA_SIN_TC");
  });
});
