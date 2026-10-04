import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchClienteFinancials } from "../financials";
import { fetchEstadoCuenta } from "@/features/facturacion/estadoCuenta/services/estadoCuenta";
import { fetchEstadoCuentaFacturas } from "@/features/facturacion/services/exports";
import type { RawFactura, RawNota, RawPago } from "@/features/facturacion/estadoCuenta/services/estadoCuentaTypes";

function nota(estado: string, monto: number, deleted_at: string | null = null, moneda = "MXN"): RawNota {
  return { id: `nc-${estado}`, folio: null, fecha_emision: "2026-10-01", monto, moneda, tipo_cambio: null, estado, deleted_at };
}

function pago(monto: number, overrides: Partial<RawPago> = {}): RawPago {
  return { id: "pago", fecha_pago: "2026-10-01", monto, moneda: "MXN", tipo_cambio: null,
    monto_aplicado_factura: monto, forma_pago: "03", referencia: null, estado_rep: "Timbrado",
    deleted_at: null, ...overrides };
}

function factura(overrides: Partial<RawFactura> = {}): RawFactura {
  return { id: "a3", numero: "A3", cliente_id: "cliente", cliente_nombre: "Prueba",
    expediente: "E3", moneda: "MXN", total: 116, tipo_cambio: null, estado: "Emitida",
    fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-10",
    pagos_factura: [], factura_notas_credito: [], ...overrides };
}

beforeEach(() => {
  mock.resetResults();
  mock.tableCalls.length = 0;
  mock.setRpcResult("profit_por_cliente", { data: [], error: null });
});

describe("hallazgo 48: saldo neto único del cliente", () => {
  it.each(["Timbrada", "Aplicada"])("116 menos NC %s de 58 da 58 en KPI, tabla/CSV y PDF", async (estado) => {
    mock.setTableResult("facturas", { data: [factura({ factura_notas_credito: [nota(estado, 58)] })], error: null });
    const kpi = await fetchClienteFinancials("cliente");
    const tabla = await fetchEstadoCuenta({ clienteIds: ["cliente"] });
    const pdf = await fetchEstadoCuentaFacturas("cliente");
    expect(kpi.facturadoMXN).toBe(116);
    expect(kpi.pendienteMXN).toBe(58);
    expect(tabla[0].saldo).toBe(58);
    expect(pdf[0]).toMatchObject({ total: 116, saldo: 58 });
    expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
  });

  it("combina pagos parciales y varias facturas/monedas sin descontar créditos o pagos anulados", async () => {
    mock.setTableResult("facturas", { data: [
      factura({ id: "a1", numero: "A1", total: 58, estado: "Pagada", pagos_factura: [pago(58)] }),
      factura({ id: "a2", numero: "A2", total: 58, estado: "Pagada", factura_notas_credito: [nota("Aplicada", 58)] }),
      factura({ factura_notas_credito: [nota("Timbrada", 58)] }),
      factura({ id: "parcial", numero: "Parcial", total: 200, estado: "Parcialmente pagada",
        pagos_factura: [pago(50), pago(100, { estado_rep: " Cancelado " }), pago(25, { deleted_at: "2026-10-02" })],
        factura_notas_credito: [nota("Cancelada", 30), nota("Borrador", 20), nota("Aplicada", 25, "2026-10-02")] }),
      factura({ id: "usd", numero: "USD", moneda: "USD", tipo_cambio: 20, total: 100, estado: "Parcialmente pagada",
        pagos_factura: [pago(10, { moneda: "USD" })], factura_notas_credito: [nota("Aplicada", 20, null, "USD")] }),
    ], error: null });
    const kpi = await fetchClienteFinancials("cliente");
    const tabla = await fetchEstadoCuenta({ clienteIds: ["cliente"] });
    const pdf = await fetchEstadoCuentaFacturas("cliente");
    expect(kpi.facturadoMXN).toBe(2432);
    expect(kpi.pendienteMXN).toBe(1608); // MXN 58 + 150 + USD 70 × TC histórico 20.
    expect(tabla.map((f) => f.saldo)).toEqual([0, 0, 58, 150, 70]);
    expect(pdf.map((f) => [f.numero, f.saldo])).toEqual([["A3", 58], ["Parcial", 150], ["USD", 70]]);
  });

  it("no oculta saldo de una factura Pagada cuyo REP fue anulado", async () => {
    mock.setTableResult("facturas", { data: [factura({ estado: "Pagada", pagos_factura: [pago(116, { estado_rep: "Cancelado" })] })], error: null });
    expect((await fetchClienteFinancials("cliente")).pendienteMXN).toBe(116);
    expect((await fetchEstadoCuentaFacturas("cliente"))[0].saldo).toBe(116);
  });

  it("falla visiblemente si el detalle compartido llega al límite de filas", async () => {
    mock.setTableResult("facturas", { data: Array.from({ length: 2000 }, () => factura()), error: null });
    await expect(fetchClienteFinancials("cliente")).rejects.toThrow("LC_RESULTADO_TRUNCADO");
    await expect(fetchEstadoCuentaFacturas("cliente")).rejects.toThrow("LC_RESULTADO_TRUNCADO");
  });
});
