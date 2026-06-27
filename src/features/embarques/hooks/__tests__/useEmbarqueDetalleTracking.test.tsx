import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockCreateLink } = vi.hoisted(() => ({ mockCreateLink: vi.fn() }));

vi.mock("@/features/embarques/services/tracking", () => ({
  createTrackingLink: mockCreateLink,
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
  clipboardWriteMock.mockReset();
  clipboardWriteMock.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: clipboardWriteMock } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useEmbarqueDetalleTracking", () => {
  it("crea enlace y lo copia al portapapeles", async () => {
    mockCreateLink.mockResolvedValue({ id: "tl-1", embarque_id: "e-1", token: "tok-xyz", expires_at: null });
    const { result } = renderHook(() => useEmbarqueDetalleTracking("e-1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.handleCompartirTracking();
    });
    expect(mockCreateLink).toHaveBeenCalledWith({ embarqueId: "e-1" });
    expect(clipboardWriteMock).toHaveBeenCalledWith(
      expect.stringContaining("tok-xyz"),
    );
  });

  it("no hace nada si embarqueId es undefined", async () => {
    const { result } = renderHook(() => useEmbarqueDetalleTracking(undefined), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.handleCompartirTracking();
    });
    expect(mockCreateLink).not.toHaveBeenCalled();
  });
});
