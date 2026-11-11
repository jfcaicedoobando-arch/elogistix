import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@/features/embarques/services", () => ({
  fetchEventosEmbarque: mockFetch,
  fetchEmbarqueFull: vi.fn(),
  fetchEmbarquesRelacionados: vi.fn(),
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

import { useEventosEmbarque } from "../useEventosEmbarque";

const eventosStub = [
  { id: "ev-1", embarque_id: "e-1", tipo: "Zarpe", descripcion: "Zarpó", ubicacion: "Manzanillo", fecha: "2024-01-01", usuario: "user-1", created_at: "2024-01-01T00:00:00Z" },
];

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useEventosEmbarque", () => {
  it("devuelve eventos del embarque", async () => {
    mockFetch.mockResolvedValue(eventosStub);
    const { result } = renderHook(() => useEventosEmbarque("e-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(eventosStub);
  });

  it("no ejecuta query sin embarqueId", () => {
    const { result } = renderHook(() => useEventosEmbarque(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
