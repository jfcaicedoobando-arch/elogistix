/**
 * C25 (v13.823.380) — Candados de fusión de proformas en el controller.
 *
 * 1. Una proforma FUENTE ya consolidada (`estado_revision = 'consolidada'`) no
 *    es convertible: sus conceptos se repuntaron a la proforma consolidada.
 * 2. Mezclar una proforma consolidada con individuales, o proformas con plazos
 *    de crédito distintos, invalida la fusión (`sameTipo`/`sameDiasCredito`).
 * 3. Una fusión homogénea sigue siendo válida.
 */
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

const proforma = (overrides: Record<string, unknown> = {}) => ({
  id: "p1", numero: "P-001", expediente: "EXP-001",
  cliente_id: "c1", cliente_nombre: "ACME", organization_id: "org-1",
  operador: "Op1", dias_credito: 30,
  subtotal_usd: 0, iva_usd: 0, total_usd: 0,
  subtotal_mxn: 1000, iva_mxn: 160, total_mxn: 1160,
  fecha_emision: "2026-01-15",
  estado_proforma: "pendiente", estado_cliente: "aceptada",
  estado_revision: "aprobada", es_consolidada: false,
  folio_factura_externa: null, fecha_facturacion: null,
  ...overrides,
});

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function seleccionar(ids: string[], data: unknown[]) {
  mockUseProformas.mockReturnValue({ data, isLoading: false } as never);
  const { result } = renderHook(() => useTabProformasController(), { wrapper: makeWrapper() });
  act(() => { ids.forEach((id) => result.current.toggleSelected(id)); });
  return result;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("C25 · fusión de proformas", () => {
  it("una proforma fuente ya consolidada no es convertible ni seleccionable", () => {
    const fuente = proforma({ id: "p2", estado_revision: "consolidada" });
    const result = seleccionar(["p2"], [proforma(), fuente]);

    expect(result.current.isConvertible(fuente as never)).toBe(false);
    expect(result.current.isConvertible(proforma() as never)).toBe(true);
    expect(result.current.selectedProformas).toHaveLength(0);
  });

  it("mezclar consolidada con individual invalida la fusión", () => {
    const consolidada = proforma({ id: "p2", es_consolidada: true });
    const result = seleccionar(["p1", "p2"], [proforma(), consolidada]);

    expect(result.current.selectedProformas).toHaveLength(2);
    expect(result.current.fusionInfo.sameCliente).toBe(true);
    expect(result.current.fusionInfo.sameTipo).toBe(false);
  });

  it("plazos de crédito distintos invalidan la fusión", () => {
    const otra = proforma({ id: "p2", dias_credito: 15 });
    const result = seleccionar(["p1", "p2"], [proforma(), otra]);

    expect(result.current.fusionInfo.sameTipo).toBe(true);
    expect(result.current.fusionInfo.sameDiasCredito).toBe(false);
  });

  it("una fusión homogénea sigue siendo válida", () => {
    const otra = proforma({ id: "p2", numero: "P-002" });
    const result = seleccionar(["p1", "p2"], [proforma(), otra]);

    expect(result.current.selectedProformas).toHaveLength(2);
    expect(result.current.fusionInfo.sameCliente).toBe(true);
    expect(result.current.fusionInfo.sameTipo).toBe(true);
    expect(result.current.fusionInfo.sameDiasCredito).toBe(true);
    expect(result.current.fusionInfo.diasCredito).toBe(30);
  });
});
