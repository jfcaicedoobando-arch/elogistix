/**
 * Tests del controller `useEmbarquesPageController`.
 * Foco: exposición de estado/columnas y `exportarCsv` (happy path,
 * sin datos, error de fetch).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createWrapper } from "@/test/utils/queryWrapper";
import React from "react";

const fetchExport = vi.fn();
const exportToCsv = vi.fn();
const toastFn = vi.fn();
const calcularEstado = vi.fn((_m, _t, _e, _e2, est: string) => est);

vi.mock("@/generators/exportCsv", () => ({
  exportToCsv: (...a: unknown[]) => exportToCsv(...a),
}));
vi.mock("@/features/embarques/services", () => ({
  fetchEmbarquesParaExport: (...a: unknown[]) => fetchExport(...a),
}));
vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  calcularEstadoEmbarque: (...a: unknown[]) => calcularEstado(...(a as [string, string, unknown, unknown, string])),
  usePrefetchEmbarque: () => vi.fn(),
}));
vi.mock("@/features/cliente/hooks/useClientes", () => ({
  useClientesForSelect: () => ({ data: [{ id: "c1", nombre: "ACME" }] }),
}));
vi.mock("@/features/catalogos/hooks/useOperadoresDistintos", () => ({
  useOperadoresDistintos: () => ({ data: ["op-1"] }),
}));
vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({ canEdit: true }),
  useToast: () => ({ toast: toastFn }),
  useOrgFilter: () => ({ organizationId: "org-1" }),
}));
vi.mock("@/features/embarques/hooks/useEmbarquesPageState", () => ({
  useEmbarquesPageState: () => ({
    isLoading: false, isEmptyState: false,
    contenedoresPorExpediente: {}, extras: { docs: {} },
    embarques: [{ id: "e1" }],
    debouncedSearch: "", filterModo: "todos", filterCliente: "todos",
    filterOperador: "todos", filterEstado: "todos",
    fechaDesde: "", fechaHasta: "",
  }),
}));
vi.mock("@/features/embarques/hooks/useContenedoresInfoMap", () => ({
  useContenedoresInfoMap: () => ({ data: {} }),
}));
vi.mock("@/features/embarques/table/embarqueColumns", () => ({
  buildEmbarqueColumns: () => [{ id: "expediente" }, { id: "cliente_nombre" }],
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

import { useEmbarquesPageController } from "../useEmbarquesPageController";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

// v13.137.36: factory por-test para evitar QueryClient leak (ver
// useEmbarqueSubmitOrchestrator.test.tsx).
const makeWrapper = () => {
  const Q = createWrapper();
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter><Q>{children}</Q></MemoryRouter>
  );
};

beforeEach(() => { vi.clearAllMocks(); });

describe("useEmbarquesPageController", () => {
  it("expone columnas, canEdit y operadores", () => {
    const { result } = renderHook(() => useEmbarquesPageController(), { wrapper: makeWrapper() });
    expect(result.current.canEdit).toBe(true);
    expect(result.current.columns).toHaveLength(2);
    expect(result.current.operadoresUnicos).toEqual(["op-1"]);
    expect(result.current.exportandoCsv).toBe(false);
  });

  it("exportarCsv happy path: llama exportToCsv con filas y notifica success", async () => {
    fetchExport.mockResolvedValueOnce([
      { id: "e1", expediente: "EXP-001", cliente_nombre: "ACME", modo: "MAR", tipo: "FCL",
        etd: "2026-01-01", eta: "2026-02-01", estado: "Confirmado", operador: "op-1" },
    ]);
    const { result } = renderHook(() => useEmbarquesPageController(), { wrapper: makeWrapper() });
    await act(async () => { await result.current.exportarCsv(); });
    expect(exportToCsv).toHaveBeenCalledTimes(1);
    const [fileName, columns, rows] = exportToCsv.mock.calls[0];
    expect(fileName).toMatch(/^embarques_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(columns.map((c: { key: string }) => c.key)).toContain("expediente");
    expect(rows[0]).toMatchObject({ expediente: "EXP-001", cliente_nombre: "ACME" });
    expect(notifySuccess).toHaveBeenCalled();
  });

  it("exportarCsv sin datos: notifyError 'Sin datos' y NO exporta", async () => {
    fetchExport.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useEmbarquesPageController(), { wrapper: makeWrapper() });
    await act(async () => { await result.current.exportarCsv(); });
    expect(exportToCsv).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Sin datos para exportar" }),
    );
  });

  it("exportarCsv con error de fetch: notifyError con mensaje y resetea flag", async () => {
    fetchExport.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useEmbarquesPageController(), { wrapper: makeWrapper() });
    await act(async () => { await result.current.exportarCsv(); });
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Error al exportar", description: expect.stringMatching(/boom/) }),
    );
    expect(result.current.exportandoCsv).toBe(false);
  });
});
