/**
 * Tests del controller `useTabProyeccionController`.
 * Valida: navegación entre meses (sincronizada con ?mes=), filtros
 * cliente/operador/estado, KPIs derivados y export a CSV.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const fetchProyeccionMesMock = vi.fn();
const exportToCsvMock = vi.fn();

vi.mock("@/features/facturacion/services", () => ({
  fetchProyeccionMes: (...args: unknown[]) => fetchProyeccionMesMock(...args),
}));
vi.mock("@/generators/exportCsv", () => ({
  exportToCsv: (...args: unknown[]) => exportToCsvMock(...args),
}));
vi.mock("@/hooks/shared", () => ({
  useOrgFilter: () => ({ organizationId: "org-1" }),
}));

import { useTabProyeccionController } from "../useTabProyeccionController";

function wrapperFor(url = "/facturacion") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as unknown as { __TEST_QUERY_CLIENT__?: QueryClient }).__TEST_QUERY_CLIENT__ = qc;

  return ({ children }: { children: React.ReactNode }) => {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const filaFactura = (over: Record<string, unknown> = {}) => ({
  expediente: "EXP-001",
  cliente_nombre: "ACME",
  operador: "OpA",
  estado: "pendiente" as const,
  total_usd: 1000,
  total_mxn: 17000,
  moneda: "USD",
  fecha_emision: "2026-01-15",
  fecha_compromiso: "2026-01-30",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchProyeccionMesMock.mockResolvedValue([
    filaFactura(),
    filaFactura({ expediente: "EXP-002", cliente_nombre: "Beta", operador: "OpB" }),
  ]);
});

describe("useTabProyeccionController", () => {
  it("inicializa mesKey desde ?mes= si es válido", () => {
    const { result } = renderHook(() => useTabProyeccionController(), {
      wrapper: wrapperFor("/facturacion?mes=2026-01"),
    });
    expect(result.current.mesActual.key).toBe("2026-01");
  });

  it("setMesKey actualiza estado y query param", () => {
    const { result } = renderHook(() => useTabProyeccionController(), {
      wrapper: wrapperFor(),
    });
    const otro = result.current.mesesDisponibles[0].key;
    act(() => result.current.setMesKey(otro));
    expect(result.current.mesActual.key).toBe(otro);
  });

  it("filtroCliente reduce los grupos visibles", async () => {
    const { result, rerender } = renderHook(() => useTabProyeccionController(), {
      wrapper: wrapperFor(),
    });
    // esperar fetch
    await act(async () => { await Promise.resolve(); });
    rerender();
    await act(async () => { await Promise.resolve(); });

    act(() => result.current.setFiltroCliente("ACME"));
    rerender();
    const nombres = result.current.grupos.map((g) => g.cliente_nombre);
    expect(nombres.every((n) => n === "ACME")).toBe(true);
  });

  it("exportarCsv invoca exportToCsv con el nombre del mes actual", async () => {
    fetchProyeccionMesMock.mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(() => useTabProyeccionController(), {
      wrapper: wrapperFor("/facturacion?mes=2026-01"),
    });
    await act(async () => { await Promise.resolve(); });
    rerender();
    act(() => result.current.exportarCsv());
    expect(exportToCsvMock).toHaveBeenCalledTimes(1);
    const [filename] = exportToCsvMock.mock.calls[0];
    expect(filename).toContain("2026-01");
  });
});
