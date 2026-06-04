/**
 * Tests de mutation hooks de embarques: orquestación service + invalidación.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

vi.mock("@/services/embarque", () => ({
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

vi.mock("@/services/embarque/contenedores", () => ({
  crearMuchos: vi.fn().mockResolvedValue([]),
  sincronizarContenedores: vi.fn().mockResolvedValue([]),
}));

import { crearEmbarqueRpc } from "@/services/embarque";
import { crearMuchos, sincronizarContenedores } from "@/services/embarque/contenedores";
import { eliminarEmbarqueRpc } from "@/services/embarque";
import { useCreateEmbarque } from "../useCreateEmbarque";
import { useUpdateEmbarque } from "../useUpdateEmbarque";
import { useEliminarEmbarque } from "../useDeleteEmbarque";
import { queryKeys } from "@/lib/query";

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

  it("inserta contenedores hijos cuando se proveen", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateEmbarque(), { wrapper });
    await result.current.mutateAsync({
      embarque: {} as never,
      conceptosVenta: [],
      conceptosCosto: [],
      documentos: [],
      contenedores: [
        { numero_contenedor: "A1", tipo_contenedor: "40HC", peso_kg: 0, volumen_m3: 0, piezas: 0 },
      ] as never,
    });
    expect(crearMuchos).toHaveBeenCalledWith("emb-new", expect.any(Array));
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
