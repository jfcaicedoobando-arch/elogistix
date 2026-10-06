import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../categorias", () => ({ fetchCategorias: vi.fn().mockResolvedValue([{ id: "admin", nombre: "Administración" }]) }));
vi.mock("../mensual", () => ({ fetchPresupuestoMensualAnio: vi.fn().mockResolvedValue([]) }));
import { fetchPresupuestoVsReal } from "../vsReal";

beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });
it.each([
  { subtotal: 100, monto: 116, moneda: "MXN", tipo_cambio_mxn: 1, esperado: 0 },
  { subtotal: 200, monto: 216, moneda: "MXN", tipo_cambio_mxn: 1, esperado: 0 },
  { subtotal: 100, monto: 94, moneda: "MXN", tipo_cambio_mxn: 1, esperado: 0 },
  { subtotal: 1, monto: 1, moneda: "EUR", tipo_cambio_mxn: 20, esperado: 0 },
])("factura + reversión por $monto $moneda conserva costo neto cero", async ({ subtotal, monto, moneda, tipo_cambio_mxn, esperado }) => {
  mock.setTableResult("proveedor_facturas", { data: [{ categoria_presupuesto_id: "admin", subtotal, moneda, tipo_cambio_usd: tipo_cambio_mxn }], error: null });
  mock.setTableResult("proveedor_notas_credito", { data: [{ subtotal, monto, moneda, tipo_cambio: null, tipo_cambio_mxn, proveedor_facturas: { categoria_presupuesto_id: "admin", moneda, tipo_cambio_usd: tipo_cambio_mxn } }], error: null });
  const resumen = await fetchPresupuestoVsReal("2026-10");
  expect(resumen.total_real_mxn).toBe(esperado);
  expect(resumen.gastos_sin_tc_count).toBe(0);
  expect(resumen.notas_proveedor_sin_base_count).toBe(0);
});
describe("NC histórica", () => {
  it("mantiene lectura del resto del reporte con limitación explícita", async () => {
    mock.setTableResult("proveedor_facturas", { data: [{ categoria_presupuesto_id: "admin", subtotal: 100, moneda: "MXN" }], error: null });
    mock.setTableResult("proveedor_notas_credito", { data: [{ monto: 58, moneda: "MXN", proveedor_facturas: { categoria_presupuesto_id: "admin", moneda: "MXN" } }], error: null });
    const r = await fetchPresupuestoVsReal("2026-10");
    expect(r.total_real_mxn).toBe(100);
    expect(r.notas_proveedor_sin_base_count).toBe(1);
    expect(r.gastos_sin_tc_count).toBe(0);
  });
});
