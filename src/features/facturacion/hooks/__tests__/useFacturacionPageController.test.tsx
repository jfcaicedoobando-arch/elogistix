/**
 * Tests del controller `useFacturacionPageController`.
 * Valida: filtrado por búsqueda y estado, marcar pagado (success/error)
 * y export CSV con headers exactos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const {
  useFacturasListadoMock, useGastosPendientesMock,
  marcarPagadoMutate, registrarActividadMutate, toastFn,
  exportToCsvMock, exportarLayoutContableMock,
  notifyErrorMock, notifySuccessMock,
} = vi.hoisted(() => ({
  useFacturasListadoMock: vi.fn(),
  useGastosPendientesMock: vi.fn(),
  marcarPagadoMutate: vi.fn(),
  registrarActividadMutate: vi.fn(),
  toastFn: vi.fn(),
  exportToCsvMock: vi.fn(),
  exportarLayoutContableMock: vi.fn(),
  notifyErrorMock: vi.fn(),
  notifySuccessMock: vi.fn(),
}));

vi.mock("@/features/facturacion/hooks/useFacturas", () => ({
  useFacturasListado: (args: unknown) => useFacturasListadoMock(args),
  useGastosPendientes: () => useGastosPendientesMock(),
  useMarcarCostoPagado: () => ({ mutate: marcarPagadoMutate, isPending: false }),
}));
vi.mock("@/hooks/shared", () => ({
  useListPageState: () => {
    return {
      search: "", filters: { estado: "todos", cliente: "todos" }, page: 0, pageSize: 100,
      setSearch: vi.fn(), setFilter: vi.fn(), setPage: vi.fn(), setPageSize: vi.fn(),
    };
  },
  useDebounce: <T,>(v: T) => v,
  useRegistrarActividad: () => ({ mutate: registrarActividadMutate }),
  useToast: () => ({ toast: toastFn }),
  usePermissions: () => ({ canEdit: true }),
}));
vi.mock("@/generators/exportCsv", () => ({ exportToCsv: exportToCsvMock }));
vi.mock("@/generators/layoutContable", () => ({ exportarLayoutContable: exportarLayoutContableMock }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: notifyErrorMock,
  notifySuccess: notifySuccessMock,
}));

import { useFacturacionPageController } from "../useFacturacionPageController";

const f = (over: Record<string, unknown> = {}) => ({
  id: "f1", numero: "FAC-001", expediente: "EXP-001",
  cliente_nombre: "ACME", total: 1000, moneda: "USD",
  fecha_emision: "2026-01-15", fecha_vencimiento: "2026-02-15",
  estado: "pendiente", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  useFacturasListadoMock.mockReturnValue({
    data: { data: [f(), f({ id: "f2", numero: "FAC-002", cliente_nombre: "Beta" })], count: 2 },
    isLoading: false,
  });
  useGastosPendientesMock.mockReturnValue({ data: [], isLoading: false });
});

describe("useFacturacionPageController", () => {
  it("devuelve facturas paginadas cuando no hay filtros", () => {
    const { result } = renderHook(() => useFacturacionPageController(), { wrapper: createWrapper() });
    expect(result.current.paginatedFacturas).toHaveLength(2);
  });

  it("handleMarcarPagado dispara mutate y registra actividad en éxito (toast lo emite el hook)", () => {
    marcarPagadoMutate.mockImplementation((_payload, opts) => opts?.onSuccess?.());
    const { result } = renderHook(() => useFacturacionPageController(), { wrapper: createWrapper() });
    act(() => result.current.handleMarcarPagado("gasto-1"));
    expect(marcarPagadoMutate).toHaveBeenCalledWith({ id: "gasto-1" }, expect.any(Object));
    expect(registrarActividadMutate).toHaveBeenCalledWith(expect.objectContaining({
      accion: "editar", modulo: "facturas", entidad_id: "gasto-1",
    }));
    // 13.85.10 — el toast de éxito lo emite `useMarcarCostoPagado`, no el controller.
    expect(notifySuccessMock).not.toHaveBeenCalled();
  });

  it("handleMarcarPagado no notifica en error (toast lo emite el hook)", () => {
    marcarPagadoMutate.mockImplementation((_p, opts) => opts?.onError?.(new Error("boom")));
    const { result } = renderHook(() => useFacturacionPageController(), { wrapper: createWrapper() });
    act(() => result.current.handleMarcarPagado("gasto-x"));
    // 13.85.10 — el toast de error lo emite `useMarcarCostoPagado`, no el controller.
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });


  it("exportarFacturasCsv exporta con los headers esperados", () => {
    const { result } = renderHook(() => useFacturacionPageController(), { wrapper: createWrapper() });
    act(() => result.current.exportarFacturasCsv());
    expect(exportToCsvMock).toHaveBeenCalledTimes(1);
    const [filename, headers, rows] = exportToCsvMock.mock.calls[0];
    expect(filename).toMatch(/^facturas_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(headers.map((h: { key: string }) => h.key)).toEqual([
      "numero", "expediente", "cliente", "total", "moneda", "emision", "vencimiento", "estado",
    ]);
    expect(rows).toHaveLength(2);
  });

  it("exportarLayoutContable propaga error vía notifyError", async () => {
    exportarLayoutContableMock.mockRejectedValueOnce(new Error("fail"));
    const { result } = renderHook(() => useFacturacionPageController(), { wrapper: createWrapper() });
    await act(async () => { await result.current.exportarLayoutContable(); });
    expect(notifyErrorMock).toHaveBeenCalled();
  });
});
