import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";

const { fetchLinks, createLink, deleteLink, writeClipboard } = vi.hoisted(() => ({
  fetchLinks: vi.fn(), createLink: vi.fn(), deleteLink: vi.fn(), writeClipboard: vi.fn(),
}));
vi.mock("@/features/embarques/services/tracking", () => ({
  fetchTrackingLinks: fetchLinks, createTrackingLink: createLink, deleteTrackingLink: deleteLink,
  TRACKING_LINK_VIGENCIA_DIAS: 30,
  esTrackingLinkVigente: (link: { expires_at: string | null }) =>
    !!link.expires_at && new Date(link.expires_at).getTime() > Date.now(),
}));
import { useEmbarqueDetalleTracking } from "../useEmbarqueDetalleTracking";

const link = (id: string, embarqueId = "e-1") => ({
  id, embarque_id: embarqueId, token: `token-${id}`, expires_at: "2030-01-15T18:20:45Z",
  created_at: "2026-01-01T00:00:00Z",
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const renderTracking = () => renderHook(({ id }) => ({
  tracking: useEmbarqueDetalleTracking(id), cache: useQueryClient(),
}), { initialProps: { id: "e-1" }, wrapper: createWrapper() });

beforeEach(() => {
  fetchLinks.mockReset(); createLink.mockReset(); deleteLink.mockReset(); writeClipboard.mockReset();
  deleteLink.mockResolvedValue(undefined); writeClipboard.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: writeClipboard } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("identidad del enlace público copiado", () => {
  it.each(["A", "C"])("revoca B copiado aunque la caché tenga %s, incluso tras cerrar el aviso", async (cache) => {
    const a = link("A"), b = link("B"), c = link("C");
    fetchLinks.mockResolvedValue([a]);
    const { result } = renderTracking();
    await waitFor(() => expect(result.current.tracking.tieneLinkActivo).toBe(true));
    const revocarDesdeCache = result.current.tracking.handleRevocarTracking;
    fetchLinks.mockResolvedValueOnce([b, a]);
    await act(async () => { await result.current.tracking.handleCompartirTracking(); });
    expect(writeClipboard).toHaveBeenCalledWith(expect.stringContaining("token-B"));
    act(() => result.current.tracking.cerrarAvisoEnlace());
    expect(result.current.tracking.avisoEnlace).toBeNull();
    if (cache === "C") act(() => {
      result.current.cache.setQueryData(queryKeys.trackingLinks.byEmbarque("e-1"), [c, a]);
    });
    await act(async () => { await revocarDesdeCache(); });
    expect(deleteLink).toHaveBeenCalledExactlyOnceWith({ linkId: "B", embarqueId: "e-1" });
    expect(result.current.tracking.tieneLinkActivo).toBe(false);
    await act(async () => { await result.current.tracking.handleRevocarTracking(); });
    expect(deleteLink).toHaveBeenCalledTimes(1);
    fetchLinks.mockResolvedValueOnce([c, a]);
    await act(async () => { await result.current.tracking.handleCompartirTracking(); });
    await act(async () => { await result.current.tracking.handleRevocarTracking(); });
    expect(deleteLink).toHaveBeenLastCalledWith({ linkId: "C", embarqueId: "e-1" });
  });

  it("conserva B para reintentar si falla su revocación y no sustituye el objetivo por la caché A", async () => {
    const a = link("A"), b = link("B");
    fetchLinks.mockResolvedValue([a]);
    const { result } = renderTracking();
    await waitFor(() => expect(result.current.tracking.tieneLinkActivo).toBe(true));
    fetchLinks.mockResolvedValueOnce([b, a]);
    await act(async () => { await result.current.tracking.handleCompartirTracking(); });
    act(() => result.current.tracking.cerrarAvisoEnlace());
    deleteLink.mockRejectedValueOnce(new Error("fallo ficticio"));
    await act(async () => { await result.current.tracking.handleRevocarTracking(); });
    expect(result.current.tracking.tieneLinkActivo).toBe(true);
    await act(async () => { await result.current.tracking.handleRevocarTracking(); });
    expect(deleteLink.mock.calls).toEqual([
      [{ linkId: "B", embarqueId: "e-1" }], [{ linkId: "B", embarqueId: "e-1" }],
    ]);
  });

  it.each(["lectura", "portapapeles"])("una copia tardía durante %s no cambia el objetivo del nuevo embarque", async (fase) => {
    const a = link("A"), b = link("B", "e-2");
    fetchLinks.mockImplementation(async (id: string) => id === "e-1" ? [a] : [b]);
    const { result, rerender } = renderTracking();
    await waitFor(() => expect(result.current.tracking.tieneLinkActivo).toBe(true));
    const revocarAnterior = result.current.tracking.handleRevocarTracking;
    const lectura = deferred<typeof a[]>(), copia = deferred<void>();
    if (fase === "lectura") fetchLinks.mockReturnValueOnce(lectura.promise);
    else writeClipboard.mockReturnValueOnce(copia.promise);
    let pendiente!: Promise<void>;
    act(() => { pendiente = result.current.tracking.handleCompartirTracking(); });
    if (fase === "portapapeles") await waitFor(() => expect(writeClipboard).toHaveBeenCalled());
    rerender({ id: "e-2" });
    await waitFor(() => expect(result.current.tracking.tieneLinkActivo).toBe(true));
    await act(async () => { lectura.resolve([a]); copia.resolve(); await pendiente; });
    expect(result.current.tracking.avisoEnlace).toBeNull();
    await act(async () => { await revocarAnterior(); });
    expect(deleteLink).not.toHaveBeenCalled();
    await act(async () => { await result.current.tracking.handleRevocarTracking(); });
    expect(deleteLink).toHaveBeenCalledExactlyOnceWith({ linkId: "B", embarqueId: "e-2" });
  });

  it("un callback anterior tampoco revoca al regresar al mismo embarque en otra apertura", async () => {
    const a = link("A"), b = link("B", "e-2");
    fetchLinks.mockImplementation(async (id: string) => id === "e-1" ? [a] : [b]);
    const { result, rerender } = renderTracking();
    await waitFor(() => expect(result.current.tracking.tieneLinkActivo).toBe(true));
    const revocarAnterior = result.current.tracking.handleRevocarTracking;
    rerender({ id: "e-2" });
    await waitFor(() => expect(result.current.tracking.tieneLinkActivo).toBe(true));
    rerender({ id: "e-1" });
    await waitFor(() => expect(result.current.tracking.tieneLinkActivo).toBe(true));
    await act(async () => { await revocarAnterior(); });
    expect(deleteLink).not.toHaveBeenCalled();
    await act(async () => { await result.current.tracking.handleRevocarTracking(); });
    expect(deleteLink).toHaveBeenCalledExactlyOnceWith({ linkId: "A", embarqueId: "e-1" });
  });

  it("no inicia dos copias simultáneas mientras espera la lectura fresca", async () => {
    const a = link("A"), b = link("B");
    fetchLinks.mockResolvedValue([a]);
    const { result } = renderTracking();
    await waitFor(() => expect(result.current.tracking.tieneLinkActivo).toBe(true));
    const lectura = deferred<typeof a[]>();
    fetchLinks.mockReturnValueOnce(lectura.promise);
    let pendiente!: Promise<void>;
    act(() => { pendiente = result.current.tracking.handleCompartirTracking(); });
    expect(result.current.tracking.isPending).toBe(true);
    await act(async () => { await result.current.tracking.handleCompartirTracking(); });
    expect(fetchLinks).toHaveBeenCalledTimes(2);
    await act(async () => { lectura.resolve([b, a]); await pendiente; });
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("token-B"));
    expect(result.current.tracking.isPending).toBe(false);
  });

  it("no copia ni revoca una fila que no pertenece al embarque actual", async () => {
    fetchLinks.mockResolvedValue([link("ajeno", "otro-embarque")]);
    const { result } = renderTracking();
    await act(async () => { await result.current.tracking.handleCompartirTracking(); });
    expect(writeClipboard).not.toHaveBeenCalled();
    expect(createLink).not.toHaveBeenCalled();
    expect(result.current.tracking.tieneLinkActivo).toBe(false);
    await act(async () => { await result.current.tracking.handleRevocarTracking(); });
    expect(deleteLink).not.toHaveBeenCalled();
  });

  it("el éxito tardío de revocar A no elimina el objetivo copiado de otro embarque", async () => {
    const a = link("A"), b = link("B", "e-2");
    fetchLinks.mockImplementation(async (id: string) => id === "e-1" ? [a] : [b]);
    const { result, rerender } = renderTracking();
    await waitFor(() => expect(result.current.tracking.tieneLinkActivo).toBe(true));
    await act(async () => { await result.current.tracking.handleCompartirTracking(); });
    const borrado = deferred<void>();
    deleteLink.mockReturnValueOnce(borrado.promise);
    let pendiente!: Promise<void>;
    act(() => { pendiente = result.current.tracking.handleRevocarTracking(); });
    await waitFor(() => expect(deleteLink).toHaveBeenCalledTimes(1));
    rerender({ id: "e-2" });
    await act(async () => { await result.current.tracking.handleCompartirTracking(); });
    await act(async () => { borrado.resolve(); await pendiente; });
    expect(result.current.tracking.tieneLinkActivo).toBe(true);
    expect(result.current.tracking.avisoEnlace).not.toBeNull();
    await act(async () => { await result.current.tracking.handleRevocarTracking(); });
    expect(deleteLink.mock.calls).toEqual([
      [{ linkId: "A", embarqueId: "e-1" }], [{ linkId: "B", embarqueId: "e-2" }],
    ]);
  });

});
