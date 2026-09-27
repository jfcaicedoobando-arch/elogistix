import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryKeys } from "@/lib/query";

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
  it("preserva el ID y refresca tracking y actividad al completar el registro", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    mockInsert.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCreateEventoEmbarque({ silent: true }), { wrapper });
    const input = { eventoId: "22222222-2222-4222-8222-222222222222", embarqueId: "e-1", tipo: "Cambio de ETA", descripcion: "ETA confirmada", ubicacion: "Manzanillo", fecha: "2026-11-20", usuario: "u-1" };
    await act(async () => { await result.current.mutateAsync(input); });
    expect(mockInsert).toHaveBeenCalledWith(input);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.embarques.eventos("e-1") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.embarques.actividad("e-1") });
  });

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
