import { describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchEstadoCuenta } from "../estadoCuenta";
import type { RawFactura } from "../estadoCuentaTypes";

function factura(id: string, monto: number): RawFactura {
  return { id, numero: id, cliente_id: "c1", cliente_nombre: "Ficticio", expediente: "EXP", moneda: "MXN",
    total: 1.16, tipo_cambio: 1, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-02", estado: "Pagada",
    pagos_factura: [{ id: `p-${id}`, monto, monto_aplicado_factura: monto, moneda: "MXN", tipo_cambio: 1,
      estado_rep: "NoAplica", deleted_at: null, fecha_pago: "2026-10-03", forma_pago: "03", referencia: null }],
    factura_notas_credito: [] };
}

describe("AUD54: filtro Sólo con saldo del estado de cuenta", () => {
  it("retiene A8 con un centavo y excluye factura realmente liquidada", async () => {
    mock.setTableResult("facturas", { data: [factura("A8", 1.15), factura("completa", 1.16)], error: null });
    const rows = await fetchEstadoCuenta({ clienteIds: ["c1"], soloConSaldo: true });
    expect(rows.map((f) => f.numero)).toEqual(["A8"]);
    expect(rows[0]).toMatchObject({ total: 1.16, pagado: 1.15, saldo: .01, estado_factura: "Pagada", estatus_cobranza: "Vencida" });
  });
});

import { mapFacturaEstadoCuenta, type RawNota, type RawPago } from "../estadoCuentaTypes";
import { calcularKpisEstadoCuenta } from "../estadoCuentaAggregates";
import { calcularAging } from "../estadoCuentaAging";
import { aplicarTcPago } from "@/features/facturacion/components/registrarPagoDerivados";

const limites = [
  { saldo: .0049, monto: 6.60, tc: 5.7138, aplicado: 1.1551, cantidad: 0 },
  { saldo: .005, monto: 23.10, tc: 20, aplicado: 1.155, cantidad: 1 },
  { saldo: .01, monto: 23, tc: 20, aplicado: 1.15, cantidad: 1 },
];
function facturaFx(pagos: RawPago[], notas: RawNota[] = []): RawFactura {
  return { ...factura("FX", 0), moneda: "USD", tipo_cambio: 20,
    pagos_factura: pagos, factura_notas_credito: notas };
}
function pagoFx(monto: number, tipo_cambio: number, monto_aplicado_factura: number): RawPago {
  return { ...factura("base", 0).pagos_factura![0], monto, tipo_cambio, monto_aplicado_factura, moneda: "MXN" };
}

describe("AUD54 P1: camino RawFactura con importes FX sin redondeo previo", () => {
  it.each(limites)("pago FX conserva saldo exacto $saldo y conteo $cantidad", async ({ saldo, monto, tc, aplicado, cantidad }) => {
    expect(aplicarTcPago(monto, "MXN", "USD", tc)).toBe(aplicado);
    const raw = facturaFx([pagoFx(monto, tc, aplicado)]);
    const row = mapFacturaEstadoCuenta(raw);
    expect(row.pagado).toBe(aplicado);
    expect(row.saldo).toBe(saldo);
    expect(row.estatus_cobranza).toBe(cantidad ? "Vencida" : "Pagada");
    expect(calcularKpisEstadoCuenta([row]).facturasAdeudadas).toBe(cantidad);
    expect(calcularKpisEstadoCuenta([row]).adeudado.usd).toBe(cantidad ? .01 : 0);
    expect(calcularAging([row]).reduce((n, b) => n + b.conteo, 0)).toBe(cantidad);
    mock.setTableResult("facturas", { data: [raw], error: null });
    expect(await fetchEstadoCuenta({ clienteIds: ["c1"], soloConSaldo: true })).toHaveLength(cantidad);
  });
  it.each(limites)("NC convertidas conservan saldo exacto $saldo", ({ saldo, aplicado, cantidad }) => {
    // Dos NC USD0.50 convertidas a EUR con sus tasas históricas válidas.
    const tcNc = saldo === .0049 ? 11.551 : saldo === .005 ? 11.55 : 11.5;
    const notas: RawNota[] = ["Timbrada", "Aplicada"].map((estado, i) => ({
      id: `nc-${i}`, folio: `NC-${i}`, fecha_emision: "2026-10-03", monto: .5,
      moneda: "USD", tipo_cambio: tcNc, estado, deleted_at: null,
    }));
    const row = mapFacturaEstadoCuenta({ ...facturaFx([], notas), moneda: "EUR", tipo_cambio: 10 });
    expect(row.notas_credito_aplicadas).toBe(aplicado);
    expect(row.saldo).toBe(saldo);
    expect(calcularKpisEstadoCuenta([row]).facturasAdeudadas).toBe(cantidad);
    expect(calcularAging([row]).reduce((n, b) => n + b.conteo, 0)).toBe(cantidad);
  });
  it("sumar pagos y NC antes de restar conserva el empate y excluye borrados/cancelados", () => {
    const pago = pagoFx(13.10, 20, .655);
    const nc: RawNota = { id: "nc", folio: "NC", fecha_emision: "2026-10-03", monto: 10,
      moneda: "MXN", tipo_cambio: 20, estado: "Timbrada", deleted_at: null };
    const raw = facturaFx([pago, { ...pago, id: "cancelado", estado_rep: " Cancelado " },
      { ...pago, id: "borrado", deleted_at: "2026-10-04" }], [nc, { ...nc, id: "borrada", deleted_at: "2026-10-04" }]);
    const row = mapFacturaEstadoCuenta(raw);
    expect(row).toMatchObject({ pagado: .655, notas_credito_aplicadas: .5, saldo: .005 });
    expect(row.pagos).toHaveLength(1);
    expect(row.notas_credito).toHaveLength(1);
    for (const estado of ["Cancelada", "Sustituida"] as const) {
      expect(mapFacturaEstadoCuenta({ ...raw, estado }).saldo).toBe(0);
    }
  });
});
