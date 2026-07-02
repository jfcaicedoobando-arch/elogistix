import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/features/embarques/hooks/useProformas", () => ({
  useProformas: vi.fn(),
}));
vi.mock("@/features/embarques/hooks/useDescargarProformaPdf", () => ({
  useDescargarProformaPdf: () => ({ descargar: vi.fn(), downloadingId: null }),
}));
vi.mock("@/hooks/shared", () => ({
  useOrgFilter: () => ({ organizationId: "org-1" }),
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
  DEFAULT_PAGE_SIZE: 10,
}));
vi.mock("@/lib/query", () => ({
  queryKeys: { proformas: { all: ["proformas"] } },
}));

import { useProformas } from "@/features/embarques/hooks/useProformas";
import { useTabProformasController } from "../useTabProformasController";

const mockUseProformas = vi.mocked(useProformas);

const proforma = (overrides = {}) => ({
  id: "p1", numero: "P-001", expediente: "EXP-001", cliente_nombre: "ACME",
  operador: "Op1", dias_credito: 30, subtotal_usd: 100, iva_usd: 16, total_usd: 116,
  subtotal_mxn: 1000, iva_mxn: 160, total_mxn: 1160,
  fecha_emision: "2024-01-15", estado_proforma: "pendiente",
  folio_factura_externa: null, fecha_facturacion: null,
  ...overrides,
});

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe("useTabProformasController", () => {
  it("happy path: expone proformas, counts y csvColumns", async () => {
    mockUseProformas.mockReturnValue({ data: [proforma()], isLoading: false } as never);
    const { result } = renderHook(() => useTabProformasController(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.proformas).toHaveLength(1);
    expect(result.current.counts.todas).toBe(1);
    expect(result.current.counts.facturada).toBe(0);
    expect(result.current.csvColumns.length).toBeGreaterThan(0);
  });

  it("csvRows mapea correctamente los campos", () => {
    mockUseProformas.mockReturnValue({ data: [proforma()], isLoading: false } as never);
    const { result } = renderHook(() => useTabProformasController(), { wrapper: makeWrapper() });
    const rows = result.current.csvRows();
    expect(rows[0].numero).toBe("P-001");
    expect(rows[0].cliente).toBe("ACME");
    expect(rows[0].estado).toBe("pendiente");
  });

  it("setSearch filtra proformas correctamente", () => {
    const p2 = proforma({ id: "p2", numero: "P-002", expediente: "EXP-002", cliente_nombre: "Beta Corp" });
    mockUseProformas.mockReturnValue({ data: [proforma(), p2], isLoading: false } as never);
    const { result } = renderHook(() => useTabProformasController(), { wrapper: makeWrapper() });

    act(() => { result.current.setSearch("beta"); });
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].cliente_nombre).toBe("Beta Corp");
  });

  it("error path: isLoading true cuando useProformas carga", () => {
    mockUseProformas.mockReturnValue({ data: [], isLoading: true } as never);
    const { result } = renderHook(() => useTabProformasController(), { wrapper: makeWrapper() });
    expect(result.current.isLoading).toBe(true);
  });
});
