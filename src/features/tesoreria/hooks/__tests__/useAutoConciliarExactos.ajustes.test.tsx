import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { useAutoConciliarExactos } from "../useAutoConciliarExactos";
import type { MovimientoBBVA } from "@/features/tesoreria/services";
const ajuste = { id: "ajuste", es_ajuste: true, monto: 1, moneda: "MXN", fecha_pago: "2026-10-07", referencia: null };
// SAFE-CAST: sólo se consumen cuenta, fecha, importes, id y estado en este flujo.
const mov = { id: "mov", cuenta_bancaria_id: "cuenta", cargo: 1, abono: 0, fecha: "2026-10-07", estado_conciliacion: "Pendiente" } as MovimientoBBVA;
beforeEach(() => {
  mock.resetResults(); mock.tableCalls.length = 0;
  mock.setTableResult("cuentas_bancarias", { data: { moneda: "MXN" }, error: null });
});
describe("auto-conciliación real con sugeridor filtrado", () => {
  it("un ajuste exacto único no produce mutación", async () => {
    mock.setTableResult("pagos_proveedor", { data: [ajuste], error: null });
    const conciliar = vi.fn();
    const { result } = renderHook(() => useAutoConciliarExactos([mov], conciliar));
    await act(() => result.current.handleConciliarExactos());
    expect(conciliar).not.toHaveBeenCalled();
    expect(result.current.isAutoConciliando).toBe(false);
  });
  it("ajuste más pago monetario no vuelve ambiguo al pago válido", async () => {
    mock.setTableResult("pagos_proveedor", { data: [ajuste, { ...ajuste, id: "real", es_ajuste: false }], error: null });
    const conciliar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoConciliarExactos([mov], conciliar));
    await act(() => result.current.handleConciliarExactos());
    expect(conciliar).toHaveBeenCalledExactlyOnceWith({ movId: "mov", tipo: "cxp", pagoId: "real" });
  });
});
