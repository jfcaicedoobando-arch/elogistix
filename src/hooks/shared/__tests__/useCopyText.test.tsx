import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const successMock = vi.fn();
const errorMock = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => successMock(...a), error: vi.fn() },
}));
vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifyError: (...a: unknown[]) => errorMock(...a),
}));

// Mock usehooks-ts useCopyToClipboard: returns [copiedText, copyFn].
const copyFnMock = vi.fn(async (_t: string) => true);
vi.mock("usehooks-ts", () => ({
  useCopyToClipboard: () => [null, copyFnMock],
}));

import { useCopyText } from "../useCopyText";

describe("useCopyText", () => {
  beforeEach(() => {
    successMock.mockReset();
    errorMock.mockReset();
    copyFnMock.mockReset();
    copyFnMock.mockResolvedValue(true);
  });

  it("copia y muestra toast success con mensaje default", async () => {
    const { result } = renderHook(() => useCopyText());
    let ok = false;
    await act(async () => {
      ok = await result.current("hola");
    });
    expect(ok).toBe(true);
    expect(copyFnMock).toHaveBeenCalledWith("hola");
    expect(successMock).toHaveBeenCalledWith("Copiado al portapapeles");
  });

  it("usa successMessage custom", async () => {
    const { result } = renderHook(() => useCopyText());
    await act(async () => {
      await result.current("x", { successMessage: "UUID copiado" });
    });
    expect(successMock).toHaveBeenCalledWith("UUID copiado");
  });

  it("notifica error cuando la copia falla", async () => {
    copyFnMock.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useCopyText());
    let ok = true;
    await act(async () => {
      ok = await result.current("x", { errorTitle: "Falló", method: "test" });
    });
    expect(ok).toBe(false);
    expect(errorMock).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Falló", method: "test" }),
    );
    expect(successMock).not.toHaveBeenCalled();
  });
});
