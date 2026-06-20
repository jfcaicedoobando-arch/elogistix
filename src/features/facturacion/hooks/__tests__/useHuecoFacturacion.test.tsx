import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/hooks/shared", () => ({
  useOrgFilter: () => ({ organizationId: "org-1" }),
}));
vi.mock("@/features/facturacion/services", () => ({
  fetchHuecoFacturacion: vi.fn(),
}));
vi.mock("@/generators/exportCsv", () => ({
  exportToCsv: vi.fn(),
}));
vi.mock("@/features/facturacion/domain/huecoCsv", () => ({
  HUECO_CSV_HEADERS: ["col"],
  buildHuecoCsvFilename: () => "hueco.csv",
  buildHuecoCsvRows: (filas: unknown[]) => filas,
}));
vi.mock("@/lib/query", () => ({
  queryKeys: { facturacion: { hueco: (id: string) => ["facturacion", "hueco", id] } },
}));

import { fetchHuecoFacturacion } from "@/features/facturacion/services";
import { exportToCsv } from "@/generators/exportCsv";
import { useHuecoFacturacion } from "../useHuecoFacturacion";

const mockFetch = vi.mocked(fetchHuecoFacturacion);
const mockExport = vi.mocked(exportToCsv);

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("useHuecoFacturacion", () => {
  it("happy path: expone filas y totales del servicio", async () => {
    mockFetch.mockResolvedValue({
      filas: [{ id: "f1" } as never],
      totalEmbarques: 3,
      totalUsd: 1000,
      totalMxn: 18000,
    });
    const { result } = renderHook(() => useHuecoFacturacion(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.filas).toHaveLength(1);
    expect(result.current.totalEmbarques).toBe(3);
    expect(result.current.totalUsd).toBe(1000);
    expect(result.current.totalMxn).toBe(18000);
  });

  it("error path: filas vacías cuando el servicio falla", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useHuecoFacturacion(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.filas).toEqual([]);
    expect(result.current.totalEmbarques).toBe(0);
  });

  it("exportarCsv no llama exportToCsv cuando filas está vacío", async () => {
    mockFetch.mockResolvedValue({ filas: [], totalEmbarques: 0, totalUsd: 0, totalMxn: 0 });
    const { result } = renderHook(() => useHuecoFacturacion(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    result.current.exportarCsv();
    expect(mockExport).not.toHaveBeenCalled();
  });

  it("exportarCsv llama exportToCsv cuando hay filas", async () => {
    mockFetch.mockResolvedValue({ filas: [{ id: "f1" } as never], totalEmbarques: 1, totalUsd: 0, totalMxn: 0 });
    const { result } = renderHook(() => useHuecoFacturacion(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    result.current.exportarCsv();
    expect(mockExport).toHaveBeenCalledWith("hueco.csv", ["col"], expect.any(Array));
  });
});
