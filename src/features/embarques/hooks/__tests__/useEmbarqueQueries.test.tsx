import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockById, mockVenta, mockCosto, mockPaginados, mockExpedientes, mockProveedores } = vi.hoisted(() => ({
  mockById: vi.fn(),
  mockVenta: vi.fn(),
  mockCosto: vi.fn(),
  mockPaginados: vi.fn(),
  mockExpedientes: vi.fn(),
  mockProveedores: vi.fn(),
}));

vi.mock("@/features/embarques/services", () => ({
  fetchEmbarqueById: mockById,
  fetchEmbarqueConceptosVenta: mockVenta,
  fetchEmbarqueConceptosCosto: mockCosto,
  fetchEmbarquesPaginados: mockPaginados,
  fetchExpedientesCliente: mockExpedientes,
  fetchProveedoresForSelect: mockProveedores,
  fetchEmbarqueFull: vi.fn(),
  fetchEmbarquesRelacionados: vi.fn(),
  fetchEventosEmbarque: vi.fn(),
  insertEventoEmbarque: vi.fn(),
  fetchEmbarquesParaExport: vi.fn(),
  fetchEmbarquesListExtras: vi.fn(),
  resolverExpediente: vi.fn(),
  subirDocumentosEmbarque: vi.fn(),
}));

vi.mock("@/hooks/shared/useOrgFilter", () => ({
  useOrgFilter: () => ({ organizationId: "org-1" }),
}));

import { useEmbarque, useEmbarqueConceptosVenta, useEmbarqueConceptosCosto } from "../useEmbarqueQueries";

const embarqueStub = { id: "e-1", expediente: "EXP-001" };

beforeEach(() => {
  mockById.mockReset();
  mockVenta.mockReset();
  mockCosto.mockReset();
  mockPaginados.mockReset();
  mockExpedientes.mockReset();
  mockProveedores.mockReset();
});

describe("useEmbarque", () => {
  it("retorna el embarque por id", async () => {
    mockById.mockResolvedValue(embarqueStub);
    const { result } = renderHook(() => useEmbarque("e-1"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(embarqueStub);
  });

  it("no ejecuta sin id", () => {
    const { result } = renderHook(() => useEmbarque(undefined), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useEmbarqueConceptosVenta", () => {
  it("retorna conceptos de venta del embarque", async () => {
    mockVenta.mockResolvedValue([{ id: "cv-1" }]);
    const { result } = renderHook(() => useEmbarqueConceptosVenta("e-1"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "cv-1" }]);
  });
});

describe("useEmbarqueConceptosCosto", () => {
  it("retorna conceptos de costo del embarque", async () => {
    mockCosto.mockResolvedValue([{ id: "cc-1" }]);
    const { result } = renderHook(() => useEmbarqueConceptosCosto("e-1"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "cc-1" }]);
  });
});
