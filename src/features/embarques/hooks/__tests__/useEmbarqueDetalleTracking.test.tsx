import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockCreateLink, mockFetchLinks, mockDeleteLink } = vi.hoisted(() => ({
  mockCreateLink: vi.fn(),
  mockFetchLinks: vi.fn(),
  mockDeleteLink: vi.fn(),
}));

vi.mock("@/features/embarques/services/tracking", () => ({
  createTrackingLink: mockCreateLink,
  fetchTrackingLinks: mockFetchLinks,
  deleteTrackingLink: mockDeleteLink,
  TRACKING_LINK_VIGENCIA_DIAS: 30,
  // Misma lógica que la util real: vigente = expires_at en el futuro.
  esTrackingLinkVigente: (l: { expires_at: string | null }) =>
    !!l.expires_at && new Date(l.expires_at).getTime() > Date.now(),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { useEmbarqueDetalleTracking } from "../useEmbarqueDetalleTracking";

// Auditoría 13.137.31 (barrido de mutaciones globales): el `Object.assign(navigator, ...)`
// a nivel módulo dejaba `navigator.clipboard` parcheado para TODOS los archivos posteriores
// del shard bajo singleFork. Migrado a `vi.stubGlobal("navigator", ...)` por test, con
// `vi.unstubAllGlobals()` en afterEach para restauración garantizada.
const clipboardWriteMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  mockCreateLink.mockReset();
  mockFetchLinks.mockReset();
  mockDeleteLink.mockReset();
  clipboardWriteMock.mockReset();
  clipboardWriteMock.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: clipboardWriteMock } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useEmbarqueDetalleTracking", () => {
  it("sin liga vigente: crea una NUEVA con vigencia de 30 días y la copia", async () => {
    mockFetchLinks.mockResolvedValue([]);
    mockCreateLink.mockResolvedValue({ id: "tl-1", embarque_id: "e-1", token: "tok-xyz", expires_at: "2030-01-15T18:20:45Z" });
    const { result } = renderHook(() => useEmbarqueDetalleTracking("e-1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.handleCompartirTracking();
    });
    expect(mockCreateLink).toHaveBeenCalledWith({
      embarqueId: "e-1",
      expiresAt: expect.any(String),
    });
    // La vigencia debe ser ~30 días en el futuro (margen de 1 minuto).
    const expiresAt = new Date(mockCreateLink.mock.calls[0][0].expiresAt as string).getTime();
    const esperado = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiresAt - esperado)).toBeLessThan(60_000);
    expect(clipboardWriteMock).toHaveBeenCalledWith(
      expect.stringContaining("tok-xyz"),
    );
    expect(result.current.avisoEnlace).toEqual({ expiresAt: "2030-01-15T18:20:45Z" });
    act(() => result.current.cerrarAvisoEnlace());
    expect(result.current.avisoEnlace).toBeNull();
    expect(mockDeleteLink).not.toHaveBeenCalled();
  });

  it("con liga vigente: la REUTILIZA y no crea otra", async () => {
    const vigente = {
      id: "tl-9",
      embarque_id: "e-1",
      token: "tok-vigente",
      expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };
    const cacheada = { ...vigente, expires_at: new Date(Date.now() + 20 * 86400000).toISOString() };
    mockFetchLinks.mockResolvedValueOnce([cacheada]).mockResolvedValue([vigente]);
    const { result } = renderHook(() => useEmbarqueDetalleTracking("e-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.tieneLinkActivo).toBe(true));
    await act(async () => {
      await result.current.handleCompartirTracking();
    });
    expect(mockCreateLink).not.toHaveBeenCalled();
    expect(clipboardWriteMock).toHaveBeenCalledWith(
      expect.stringContaining("tok-vigente"),
    );
    expect(result.current.avisoEnlace).toEqual({ expiresAt: vigente.expires_at });
    await act(async () => { await result.current.handleRevocarTracking(); });
    expect(mockDeleteLink).toHaveBeenCalledWith({ linkId: vigente.id, embarqueId: "e-1" });
    expect(mockCreateLink).not.toHaveBeenCalled();
  });

  it("liga legacy eterna (expires_at NULL) NO se reutiliza: crea una nueva", async () => {
    mockFetchLinks.mockResolvedValue([
      { id: "tl-old", embarque_id: "e-1", token: "tok-eterno", expires_at: null, created_at: new Date().toISOString() },
    ]);
    mockCreateLink.mockResolvedValue({ id: "tl-2", embarque_id: "e-1", token: "tok-nueva", expires_at: "2026-09-30T00:00:00Z" });
    const { result } = renderHook(() => useEmbarqueDetalleTracking("e-1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.handleCompartirTracking();
    });
    expect(mockCreateLink).toHaveBeenCalledTimes(1);
    expect(clipboardWriteMock).toHaveBeenCalledWith(
      expect.stringContaining("tok-nueva"),
    );
  });

  it("no hace nada si embarqueId es undefined", async () => {
    const { result } = renderHook(() => useEmbarqueDetalleTracking(undefined), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.handleCompartirTracking();
    });
    expect(mockFetchLinks).not.toHaveBeenCalled();
    expect(mockCreateLink).not.toHaveBeenCalled();
  });

  it("no afirma que se copió si el portapapeles falla después de crear", async () => {
    mockFetchLinks.mockResolvedValue([]);
    mockCreateLink.mockResolvedValue({ id: "tl-1", embarque_id: "e-1", token: "tok-xyz", expires_at: "2030-01-15T18:20:45Z" });
    clipboardWriteMock.mockRejectedValue(new Error("Portapapeles bloqueado"));
    const { result } = renderHook(() => useEmbarqueDetalleTracking("e-1"), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleCompartirTracking(); });
    expect(mockCreateLink).toHaveBeenCalledTimes(1);
    expect(result.current.avisoEnlace).toBeNull();
    expect(mockDeleteLink).not.toHaveBeenCalled();
  });

  it("cierra el aviso al cambiar de embarque y no lo recupera al regresar", async () => {
    mockFetchLinks.mockResolvedValue([]);
    mockCreateLink.mockResolvedValue({ id: "tl-1", embarque_id: "e-1", token: "tok-xyz", expires_at: "2030-01-15T18:20:45Z" });
    const { result, rerender } = renderHook(({ id }) => useEmbarqueDetalleTracking(id), {
      initialProps: { id: "e-1" }, wrapper: createWrapper(),
    });
    await act(async () => { await result.current.handleCompartirTracking(); });
    expect(result.current.avisoEnlace).not.toBeNull();
    rerender({ id: "e-2" });
    expect(result.current.avisoEnlace).toBeNull();
    rerender({ id: "e-1" });
    expect(result.current.avisoEnlace).toBeNull();
  });

  it.each(["lectura", "portapapeles"])("descarta el aviso del embarque anterior si cambia durante %s", async (fase) => {
    const vigente = { id: "tl-1", embarque_id: "e-1", token: "tok-anterior", expires_at: "2030-01-15T18:20:45Z" };
    mockFetchLinks.mockResolvedValue([vigente]);
    const { result, rerender } = renderHook(({ id }) => useEmbarqueDetalleTracking(id), {
      initialProps: { id: "e-1" }, wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.tieneLinkActivo).toBe(true));
    let liberarLectura!: (value: typeof vigente[]) => void;
    let liberarCopia!: () => void;
    const lectura = new Promise<typeof vigente[]>(resolve => { liberarLectura = resolve; });
    const copia = new Promise<void>(resolve => { liberarCopia = resolve; });
    if (fase === "lectura") mockFetchLinks.mockReturnValueOnce(lectura);
    else clipboardWriteMock.mockReturnValueOnce(copia);
    let operacion!: Promise<void>;
    act(() => { operacion = result.current.handleCompartirTracking(); });
    if (fase === "portapapeles") await waitFor(() => expect(clipboardWriteMock).toHaveBeenCalled());
    rerender({ id: "e-2" });
    await act(async () => {
      liberarLectura([vigente]);
      liberarCopia();
      await operacion;
    });
    expect(clipboardWriteMock).toHaveBeenCalledWith(expect.stringContaining("tok-anterior"));
    expect(result.current.avisoEnlace).toBeNull();
    rerender({ id: "e-1" });
    expect(result.current.avisoEnlace).toBeNull();
    expect(mockCreateLink).not.toHaveBeenCalled();
  });
});
