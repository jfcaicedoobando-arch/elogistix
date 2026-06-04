import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock("@/features/embarques/services", () => ({
  fetchEmbarquesRelacionados: mockFetch,
  fetchEmbarqueFull: vi.fn(),
  fetchEventosEmbarque: vi.fn(),
  insertEventoEmbarque: vi.fn(),
  fetchEmbarquesParaExport: vi.fn(),
  fetchEmbarquesListExtras: vi.fn(),
  resolverExpediente: vi.fn(),
  subirDocumentosEmbarque: vi.fn(),
  fetchEmbarquesPaginados: vi.fn(),
  fetchEmbarqueById: vi.fn(),
  fetchEmbarqueConceptosVenta: vi.fn(),
  fetchEmbarqueConceptosCosto: vi.fn(),
  fetchExpedientesCliente: vi.fn(),
  fetchProveedoresForSelect: vi.fn(),
}));

import { useEmbarquesRelacionados } from "../useEmbarquesRelacionados";

beforeEach(() => mockFetch.mockReset());

describe("useEmbarquesRelacionados", () => {
  it("retorna embarques relacionados por BL Master", async () => {
    const related = [{ id: "e-2", expediente: "EXP-002" }];
    mockFetch.mockResolvedValue(related);
    const { result } = renderHook(
      () => useEmbarquesRelacionados("e-1", "BL-MASTER-001"),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(related);
    expect(mockFetch).toHaveBeenCalledWith("e-1", "BL-MASTER-001");
  });

  it("no ejecuta query cuando blMaster es null", () => {
    const { result } = renderHook(
      () => useEmbarquesRelacionados("e-1", null),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
