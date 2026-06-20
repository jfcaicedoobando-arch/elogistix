import { describe, it, expect, vi, beforeEach } from "vitest";
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

Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

beforeEach(() => {
  mockCreateLink.mockReset();
  vi.mocked(navigator.clipboard.writeText).mockReset();
});

describe("useEmbarqueDetalleTracking", () => {
  it("crea enlace y lo copia al portapapeles", async () => {
    mockCreateLink.mockResolvedValue({ id: "tl-1", embarque_id: "e-1", token: "tok-xyz", expires_at: null });
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    const { result } = renderHook(() => useEmbarqueDetalleTracking("e-1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.handleCompartirTracking();
    });
    expect(mockCreateLink).toHaveBeenCalledWith({ embarqueId: "e-1" });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
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
