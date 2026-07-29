import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useHistorialTcDof, useUpsertTcDofManual, tcDofKeys } from "../useTipoCambioDof";

vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({
  fetchHistorialTcDof: vi.fn(),
  upsertTcDofManual: vi.fn(),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

const FILA = {
  fecha: "2026-07-28",
  usd_mxn: 17.4312,
  eur_mxn: 19.9389,
  fuente: "banxico",
  origen: "automatico",
  updated_at: "2026-07-28T13:05:00Z",
};

describe("useTipoCambioDof", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tcDofKeys.historial incluye el límite", () => {
    expect(tcDofKeys.historial(90)).toEqual(["tipos_cambio_dof", "historial", 90]);
  });

  it("useHistorialTcDof trae el historial", async () => {
    const { fetchHistorialTcDof } = await import("@/features/catalogos/services/tipoCambioDof");
    vi.mocked(fetchHistorialTcDof).mockResolvedValue([FILA]);

    const { result } = renderHook(() => useHistorialTcDof(90), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([FILA]);
    expect(fetchHistorialTcDof).toHaveBeenCalledWith(90);
  });

  it("useUpsertTcDofManual notifica éxito", async () => {
    const { upsertTcDofManual } = await import("@/features/catalogos/services/tipoCambioDof");
    const { notifySuccess } = await import("@/lib/ui/appFeedback");
    vi.mocked(upsertTcDofManual).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpsertTcDofManual(), { wrapper: createWrapper() });
    result.current.mutate({ fecha: "2026-07-29", usdMxn: 18, eurMxn: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalled();
  });

  it("useUpsertTcDofManual notifica error", async () => {
    const { upsertTcDofManual } = await import("@/features/catalogos/services/tipoCambioDof");
    const { notifyError } = await import("@/lib/ui/appFeedback");
    vi.mocked(upsertTcDofManual).mockRejectedValue(new Error("LC_TC_DOF_FORBIDDEN"));

    const { result } = renderHook(() => useUpsertTcDofManual(), { wrapper: createWrapper() });
    result.current.mutate({ fecha: "2026-07-29", usdMxn: 18 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalled();
  });
});
