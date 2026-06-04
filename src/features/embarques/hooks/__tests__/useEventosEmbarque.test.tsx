import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockFetch, mockInsert } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/features/embarques/services", () => ({
  fetchEventosEmbarque: mockFetch,
  insertEventoEmbarque: mockInsert,
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

import { useEventosEmbarque, useCreateEventoEmbarque } from "../useEventosEmbarque";

const eventosStub = [
  { id: "ev-1", embarque_id: "e-1", tipo: "Zarpe", descripcion: "Zarpó", ubicacion: "Manzanillo", fecha: "2024-01-01", usuario: "user-1", created_at: "2024-01-01T00:00:00Z" },
];

beforeEach(() => {
  mockFetch.mockReset();
  mockInsert.mockReset();
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

describe("useCreateEventoEmbarque", () => {
  it("llama insertEventoEmbarque con los parámetros correctos", async () => {
    mockInsert.mockResolvedValue({ id: "ev-2" });
    mockFetch.mockResolvedValue([]);
    const { result } = renderHook(() => useCreateEventoEmbarque(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        embarqueId: "e-1", tipo: "Zarpe", descripcion: "Salida",
        ubicacion: "Manzanillo", fecha: "2024-06-01", usuario: "u-1",
      });
    });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ embarqueId: "e-1" }));
  });
});
