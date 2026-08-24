import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
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
    mockCreateLink.mockResolvedValue({ id: "tl-1", embarque_id: "e-1", token: "tok-xyz", expires_at: "2026-09-30T00:00:00Z" });
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
  });

  it("con liga vigente: la REUTILIZA y no crea otra", async () => {
    const vigente = {
      id: "tl-9",
      embarque_id: "e-1",
      token: "tok-vigente",
      expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };
    mockFetchLinks.mockResolvedValue([vigente]);
    const { result } = renderHook(() => useEmbarqueDetalleTracking("e-1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.handleCompartirTracking();
    });
    expect(mockCreateLink).not.toHaveBeenCalled();
    expect(clipboardWriteMock).toHaveBeenCalledWith(
      expect.stringContaining("tok-vigente"),
    );
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
});
