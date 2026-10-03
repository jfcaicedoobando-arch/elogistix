import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  pagos: [] as Array<{ monto_aplicado_factura: number; estado_rep: string }>,
  saldo: { data: 95, isError: false, isLoading: false, refetch: vi.fn() },
  notas: { data: [{ monto: 58 }], isError: false, isLoading: false, refetch: vi.fn() },
}));
vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canEdit: true, canRegistrarCobro: true, canEmitirFactura: true }) }));
vi.mock("../index", () => ({
  useFactura: () => ({ data: { id: "f1", total: 116, estado: "Emitida", uuid_fiscal: "uuid", fecha_emision: "2026-10-03" }, isLoading: false, refetch: vi.fn() }),
  usePagosFactura: () => ({ data: mocks.pagos, isError: false, isLoading: false, refetch: vi.fn() }),
}));
vi.mock("../useSaldoFactura", () => ({
  useNotasCreditoAplicadas: () => mocks.notas,
  useSaldoFacturaServidor: () => mocks.saldo,
}));
vi.mock("../useAcuseCancelacion", () => ({ useAcuseCancelacion: () => ({}) }));
vi.mock("../useDescargarCfdi", () => ({ useDescargarCfdi: () => vi.fn() }));
vi.mock("../useConceptosFactura", () => ({ useConceptosFactura: () => ({ data: [] }) }));
vi.mock("../useEliminarBorradorFactura", () => ({ useEliminarBorradorFactura: () => ({ eliminar: vi.fn(), isPending: false }) }));
vi.mock("../useTimbrarRep", () => ({ useTimbrarRep: () => ({}) }));
import { useFacturaDetalleController } from "../useFacturaDetalleController";

describe("detalle de factura: saldo del servidor y cobros vigentes", () => {
  beforeEach(() => {
    mocks.saldo.data = 95; mocks.saldo.isError = false; mocks.saldo.isLoading = false;
    mocks.pagos = []; vi.clearAllMocks();
  });
  it("no vuelve a restar NC nominales cuando el servidor trae otra conversión", () => {
    const { result } = renderHook(() => useFacturaDetalleController("f1"));
    expect(result.current.saldo).toBe(95);
    expect(result.current.totalPagado).toBe(0);
    expect(result.current.flags.puedeRegistrarPago).toBe(true);
    result.current.refetchSaldo();
    expect(mocks.saldo.refetch).toHaveBeenCalledOnce();
  });
  it("espera al saldo canónico y bloquea cobros mientras carga", () => {
    mocks.saldo.isLoading = true;
    const { result } = renderHook(() => useFacturaDetalleController("f1"));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.flags.puedeRegistrarPago).toBe(false);
  });
  it("un error del saldo servidor bloquea cobros y ofrece reintento", () => {
    mocks.saldo.isError = true;
    const { result } = renderHook(() => useFacturaDetalleController("f1"));
    expect(result.current.saldoError).toBe(true);
    expect(result.current.flags.puedeRegistrarPago).toBe(false);
  });
  it("Cobrado sólo suma pagos vigentes, independientemente de las NC", () => {
    mocks.pagos = [{ monto_aplicado_factura: 20, estado_rep: "NoAplica" }, { monto_aplicado_factura: 10, estado_rep: "Cancelado" }];
    mocks.saldo.data = 38;
    const { result } = renderHook(() => useFacturaDetalleController("f1"));
    expect(result.current.saldo).toBe(38);
    expect(result.current.totalPagado).toBe(20);
  });
});
