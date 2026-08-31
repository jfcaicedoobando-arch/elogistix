/**
 * Tests de mutation hooks de embarques: orquestación service + invalidación.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

vi.mock("@/features/embarques/services", () => ({
  crearEmbarqueRpc: vi.fn().mockResolvedValue({ id: "emb-new" }),
  duplicarEmbarqueRpc: vi.fn().mockResolvedValue([{ id: "emb-dup", expediente: "EXP-9" }]),
  actualizarEmbarqueRpc: vi.fn().mockResolvedValue(undefined),
  actualizarEstadoEmbarque: vi.fn().mockResolvedValue(undefined),
  avanzarEstadoEmbarqueRpc: vi.fn().mockResolvedValue(undefined),
  insertarNotaEmbarque: vi.fn().mockResolvedValue(undefined),
  insertEventoEmbarque: vi.fn().mockResolvedValue(undefined),
  uploadDocumentoEmbarque: vi.fn().mockResolvedValue(undefined),
  deleteDocumentoEmbarque: vi.fn().mockResolvedValue(undefined),
  createDocumentoEmbarqueRow: vi.fn().mockResolvedValue({ id: "doc-1" }),
  eliminarEmbarqueRpc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/embarques/services/contenedores", () => ({
  crearMuchos: vi.fn().mockResolvedValue([]),
  sincronizarContenedores: vi.fn().mockResolvedValue([]),
}));

import { crearEmbarqueRpc } from "@/features/embarques/services";
import { crearMuchos, sincronizarContenedores } from "@/features/embarques/services/contenedores";
import { eliminarEmbarqueRpc } from "@/features/embarques/services";
import { useCreateEmbarque } from "../useCreateEmbarque";
import { useUpdateEmbarque } from "../useUpdateEmbarque";
import { useEliminarEmbarque } from "../useDeleteEmbarque";
import { queryKeys } from "@/lib/query";

// v13.137.41: registramos cada QueryClient creado para limpiarlo en
// afterEach (cancelQueries → clear) y evitar leaks de subscripciones bajo
// singleFork. Antes cada test creaba un QC nuevo y nunca lo destruía.
const activeClients = new Set<QueryClient>();

afterEach(async () => {
  for (const qc of activeClients) {
    await qc.cancelQueries();
    qc.clear();
    qc.unmount();
  }
  activeClients.clear();
});

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  activeClients.add(qc);
  const spy = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc, children });
  return { qc, wrapper, spy };
}

describe("useCreateEmbarque", () => {
  it("crea el embarque y NO llama crearMuchos cuando no hay contenedores", async () => {
    const { wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useCreateEmbarque(), { wrapper });
    await result.current.mutateAsync({
      embarque: {} as never,
      conceptosVenta: [],
      conceptosCosto: [],
      documentos: [],
    });
    expect(crearEmbarqueRpc).toHaveBeenCalled();
    expect(crearMuchos).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.embarques.all });
  });

  it("envía los contenedores DENTRO de la RPC (alta atómica, M-11)", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateEmbarque(), { wrapper });
    const contenedores = [
      { numero_contenedor: "A1", tipo_contenedor: "40HC", peso_kg: 0, volumen_m3: 0, piezas: 0 },
    ];
    await result.current.mutateAsync({
      embarque: {} as never,
      conceptosVenta: [],
      conceptosCosto: [],
      documentos: [],
      contenedores: contenedores as never,
    });
    expect(crearEmbarqueRpc).toHaveBeenCalledWith(expect.objectContaining({ contenedores }));
    // Ya no hay segunda llamada: si fallara, el embarque quedaría sin contenedores.
    expect(crearMuchos).not.toHaveBeenCalled();
  });


  it("usa el requestId provisto en vez de generar uno nuevo", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateEmbarque(), { wrapper });
    await result.current.mutateAsync({
      embarque: {} as never,
      conceptosVenta: [],
      conceptosCosto: [],
      documentos: [],
      requestId: "req-fixed",
    });
    expect(crearEmbarqueRpc).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-fixed" }),
    );
  });
});

describe("useUpdateEmbarque", () => {
  it("sincroniza contenedores cuando vienen definidos e invalida las queries", async () => {
    const { wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useUpdateEmbarque(), { wrapper });
    await result.current.mutateAsync({
      id: "emb-1",
      embarque: {},
      conceptosVenta: [],
      conceptosCosto: [],
      contenedores: [],
    });
    expect(sincronizarContenedores).toHaveBeenCalledWith("emb-1", []);
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.embarques.detail("emb-1") });
  });

  it("omite sincronizarContenedores si contenedores es undefined", async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(sincronizarContenedores).mockClear();
    const { result } = renderHook(() => useUpdateEmbarque(), { wrapper });
    await result.current.mutateAsync({
      id: "emb-2",
      embarque: {},
      conceptosVenta: [],
      conceptosCosto: [],
    });
    expect(sincronizarContenedores).not.toHaveBeenCalled();
  });
});

describe("useEliminarEmbarque", () => {
  it("invoca el service y invalida embarques y cotizaciones", async () => {
    const { wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useEliminarEmbarque(), { wrapper });
    await result.current.mutateAsync("emb-9");
    expect(eliminarEmbarqueRpc).toHaveBeenCalledWith("emb-9");
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.embarques.all });
      expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.cotizaciones.all });
    });
  });
});
