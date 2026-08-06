/**
 * Tests de `useVerificarSatLote` (validación masiva SAT).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const verificarSvc = vi.fn();
const notifySuccess = vi.fn();
const notifyWarning = vi.fn();
const notifyError = vi.fn();

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: (...a: unknown[]) => notifySuccess(...a),
  notifyWarning: (...a: unknown[]) => notifyWarning(...a),
  notifyError: (...a: unknown[]) => notifyError(...a),
}));
vi.mock("@/features/cxp/services/verificarUuidSat", () => ({
  verificarUuidSat: (...a: unknown[]) => verificarSvc(...a),
}));

import { useVerificarSatLote } from "../useVerificarSatLote";

beforeEach(() => vi.clearAllMocks());

describe("useVerificarSatLote", () => {
  it("todas vigentes → éxito", async () => {
    verificarSvc.mockResolvedValue({ estatus: "Vigente" });
    const { result } = renderHook(() => useVerificarSatLote(), { wrapper: createWrapper() });

    let resumen!: Awaited<ReturnType<typeof result.current.verificar>>;
    await act(async () => {
      resumen = await result.current.verificar(["a", "b"]);
    });

    expect(verificarSvc).toHaveBeenCalledTimes(2);
    expect(verificarSvc).toHaveBeenCalledWith("a", "cxp");
    expect(resumen.vigentes).toEqual(["a", "b"]);
    expect(notifySuccess).toHaveBeenCalled();
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it("mezcla de estatus → advertencia con resumen", async () => {
    verificarSvc
      .mockResolvedValueOnce({ estatus: "Vigente" })
      .mockResolvedValueOnce({ estatus: "Cancelado" })
      .mockResolvedValueOnce({ estatus: "No verificable" });
    const { result } = renderHook(() => useVerificarSatLote(), { wrapper: createWrapper() });

    let resumen!: Awaited<ReturnType<typeof result.current.verificar>>;
    await act(async () => {
      resumen = await result.current.verificar(["a", "b", "c"]);
    });

    expect(resumen.canceladas).toEqual(["b"]);
    expect(resumen.noVerificables).toEqual(["c"]);
    expect(notifyWarning).toHaveBeenCalled();
  });

  it("todas fallan → error", async () => {
    verificarSvc.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useVerificarSatLote(), { wrapper: createWrapper() });

    let resumen!: Awaited<ReturnType<typeof result.current.verificar>>;
    await act(async () => {
      resumen = await result.current.verificar(["a"]);
    });

    expect(resumen.fallos).toHaveLength(1);
    expect(notifyError).toHaveBeenCalled();
  });

  it("selección vacía no llama al servicio", async () => {
    const { result } = renderHook(() => useVerificarSatLote(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.verificar([]);
    });
    expect(verificarSvc).not.toHaveBeenCalled();
  });
});
