import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock("@/features/embarques/services", () => ({
  fetchEmbarqueFull: mockFetch,
  fetchEmbarquesRelacionados: vi.fn(),
  fetchEventosEmbarque: vi.fn(),
  insertEventoEmbarque: vi.fn(),
  fetchEmbarquesParaExport: vi.fn(),
  fetchEmbarquesListExtras: vi.fn(),
  resolverExpediente: vi.fn(),
  subirDocumentosEmbarque: vi.fn(),
}));

import { useEmbarqueFull } from "../useEmbarqueFullQuery";

const fullStub = {
  embarque: { id: "e-1", expediente: "EXP-001", tipo_cambio_usd: 17, tipo_cambio_eur: 18 },
  conceptosVenta: [],
  conceptosCosto: [],
  documentos: [],
  notas: [],
  facturas: [],
};

beforeEach(() => mockFetch.mockReset());

describe("useEmbarqueFull", () => {
  it("retorna los datos completos del embarque", async () => {
    mockFetch.mockResolvedValue(fullStub);
    const { result } = renderHook(() => useEmbarqueFull("e-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fullStub);
  });

  it("no ejecuta query sin id", () => {
    const { result } = renderHook(() => useEmbarqueFull(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
