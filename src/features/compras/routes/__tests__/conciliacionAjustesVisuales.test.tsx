import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
const ui = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/hooks/shared", () => ({ useFiltroUrl: (_key: string, _options: unknown, value: string) => [value, vi.fn()], useTextoUrl: () => ["", vi.fn()] }));
vi.mock("@/hooks/shared/useOrgFilter", () => ({ useOrgFilter: () => ({ organizationId: "o1", orgListo: true }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: ui.rows, isLoading: false, isError: false, refetch: vi.fn() }) }));
import { listarConciliacionEmbarques } from "@/features/compras/services/conciliacionEmbarques";
import { fetchReconciliacionEmbarque } from "@/features/embarques/services/reconciliacionCostos";
import { useComprasConciliacionController } from "@/features/compras/hooks/useComprasConciliacionController";
import { FilaRenglon } from "../_sections/ConciliacionDetalleFilaRenglon";
const factura = { id: "f1", folio_proveedor: "F1", estado: "Registrada", estado_aprobacion: "aprobada", moneda: "MXN", deleted_at: null };
const preparar = (real = 900, delta = -100) => {
  const costo = { embarque_id: "e1", concepto: "Flete", proveedor_nombre: "Proveedor", moneda: "MXN", estado_liquidacion: "Pendiente", embarques: { expediente: "EXP1", cliente_nombre: "Cliente", estado: "En tránsito" } };
  mock.setTableResult("conceptos_costo", { data: [{ ...costo, id: "original", monto: 1000 }, { ...costo, id: "ajuste", concepto: "Ajuste factura", monto: delta, origen: "ajuste_factura_proveedor" }], error: null });
  mock.setTableResult("proveedor_facturas_conceptos", { data: [{ concepto_costo_id: "original", monto: real, proveedor_facturas: factura }, { concepto_costo_id: "ajuste", monto: delta, proveedor_facturas: factura }], error: null });
};
beforeEach(() => { mock.resetResults(); ui.rows = []; preparar(); });

describe("62: presentación de ajuste separado y cobertura neta", () => {
  it.each([[900, -100], [1040, 40]])("KPI neto con factura%s y ajuste%s queda conciliado sin saldo por facturar", async (real, delta) => {
    preparar(real, delta);
    ui.rows = await listarConciliacionEmbarques();
    const { result } = renderHook(useComprasConciliacionController);
    expect(result.current.kpis).toMatchObject({ sinFacturar: 0, parcial: 0, completa: 1, pendienteMxn: 0, pendienteTc: 0 });
    expect(result.current.rows[0].conceptos_pendientes).toBe(0);
  });

  it("el detalle llama al delta Ajuste de presupuesto y aclara que no suma facturación", async () => {
    const filas = await fetchReconciliacionEmbarque("e1");
    const ajuste = filas.find((fila) => fila.ajuste_presupuestario)!;
    render(<table><tbody><FilaRenglon fila={ajuste} expandido={false} onToggle={() => {}} onVincular={() => {}} /></tbody></table>);
    expect(screen.getByText("Ajuste de presupuesto")).toBeVisible();
    expect(screen.getByText(/Ajusta sólo el presupuesto/)).toBeVisible();
    expect(screen.getByText("No aplica")).toBeVisible();
    expect(screen.queryByText("Sin match")).toBeNull();
    expect(screen.queryByRole("button", { name: /Vincular/ })).toBeNull();
  });

  it("KPI conserva parcial y 40 pendientes con cobertura nominal 100% sin ajustes", async () => {
    const costo = { embarque_id: "e1", concepto: "Flete", proveedor_nombre: "Proveedor", moneda: "MXN", monto: 1000, estado_liquidacion: "Pendiente" };
    mock.setTableResult("conceptos_costo", { data: [{ ...costo, id: "a" }, { ...costo, id: "b" }], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", { data: [
      { concepto_costo_id: "a", monto: 1040, proveedor_facturas: factura },
      { concepto_costo_id: "b", monto: 960, proveedor_facturas: { ...factura, id: "f2" } },
    ], error: null });
    ui.rows = await listarConciliacionEmbarques();
    const { result } = renderHook(useComprasConciliacionController);
    expect(result.current.kpis).toMatchObject({ parcial: 1, completa: 0, pendienteMxn: 40 });
    expect(result.current.rows[0]).toMatchObject({ cobertura: 1, pendiente: 40, conceptos_pendientes: 1 });
  });
});
