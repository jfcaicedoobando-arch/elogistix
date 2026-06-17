/**
 * Cobertura del wrapper hook `useBackfillLegacy` (Fase 2 #3).
 * Verifica toasts de éxito/error y que el callback `onSuccess` se ejecuta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { rpcMock, toastSuccess, toastError } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/features/admin/services/backfillLegacy", () => ({ runAuditoriaBackfillLegacy: rpcMock }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

import { createWrapper } from "@/test/utils/queryWrapper";
import { useBackfillLegacy } from "../useBackfillLegacy";

beforeEach(() => {
  rpcMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

const fakeResult = {
  ejecutado_at: "2026-06-17T00:00:00Z",
  totales: { conceptos_actualizados: 5, embarques_afectados: 3, proformas_actualizadas: 2 },
};

describe("useBackfillLegacy", () => {
  it("dispara toast.success y onSuccess con el resultado", async () => {
    rpcMock.mockResolvedValueOnce(fakeResult);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useBackfillLegacy({ onSuccess }), { wrapper: createWrapper() });
    await act(async () => { await result.current.mutateAsync(); });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(fakeResult));
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("dispara toast.error cuando la RPC falla", async () => {
    rpcMock.mockRejectedValueOnce(new Error("permission denied"));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useBackfillLegacy({ onSuccess }), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0][0]).toBe("permission denied");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
