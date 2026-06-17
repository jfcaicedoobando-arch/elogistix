/**
 * Cobertura del wrapper hook `useTrackingPublicoPage` (Fase 2 #3).
 * Verifica que delega en `fetchTrackingPublico` con el token URL-params
 * y respeta `enabled: !!token`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/services/tracking", () => ({ fetchTrackingPublico: fetchMock }));

import { createWrapper } from "@/test/utils/queryWrapper";
import { useTrackingPublicoPage } from "../useTrackingPublicoPage";

beforeEach(() => fetchMock.mockReset());

describe("useTrackingPublicoPage", () => {
  it("llama fetchTrackingPublico con el token", async () => {
    fetchMock.mockResolvedValueOnce({ embarque: { expediente: "EXP-1" }, eventos: [], organizacion: null });
    const { result } = renderHook(() => useTrackingPublicoPage("tok-123"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("tok-123");
  });

  it("no dispara la query cuando el token es undefined", async () => {
    const { result } = renderHook(() => useTrackingPublicoPage(undefined), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propaga el error sin reintentar", async () => {
    fetchMock.mockRejectedValueOnce(new Error("token inválido"));
    const { result } = renderHook(() => useTrackingPublicoPage("bad"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
