/**
 * Tests de `useAprobarFacturasLote` (Ola B · B4).
 * Verifica el ciclo secuencial y el resumen exitos/fallos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const aprobarSvc = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifySuccess: (...a: unknown[]) => notifySuccess(...a),
  notifyError: (...a: unknown[]) => notifyError(...a),
}));
vi.mock("@/features/cxp/services/aprobacionFactura", () => ({
  aprobarFacturaProveedor: (...a: unknown[]) => aprobarSvc(...a),
}));

import { useAprobarFacturasLote } from "../useAprobarFacturasLote";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAprobarFacturasLote", () => {
  it("aprueba todas y agrega éxitos", async () => {
    aprobarSvc.mockResolvedValue({ id: "ok" });
    const { result } = renderHook(() => useAprobarFacturasLote(), { wrapper: createWrapper() });

    let resumen!: Awaited<ReturnType<typeof result.current.aprobar>>;
    await act(async () => {
      resumen = await result.current.aprobar(["a", "b", "c"]);
    });

    expect(aprobarSvc).toHaveBeenCalledTimes(3);
    expect(aprobarSvc).toHaveBeenNthCalledWith(1, "a", true);
    expect(aprobarSvc).toHaveBeenNthCalledWith(2, "b", true);
    expect(aprobarSvc).toHaveBeenNthCalledWith(3, "c", true);
    expect(resumen.exitos).toEqual(["a", "b", "c"]);
    expect(resumen.fallos).toEqual([]);
    expect(notifySuccess).toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("agrega fallos sin abortar el lote", async () => {
    aprobarSvc
      .mockResolvedValueOnce({ id: "ok1" })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ id: "ok2" });
    const { result } = renderHook(() => useAprobarFacturasLote(), { wrapper: createWrapper() });

    let resumen!: Awaited<ReturnType<typeof result.current.aprobar>>;
    await act(async () => {
      resumen = await result.current.aprobar(["a", "b", "c"]);
    });

    expect(resumen.exitos).toEqual(["a", "c"]);
    expect(resumen.fallos).toEqual([{ id: "b", error: "boom" }]);
    expect(notifySuccess).toHaveBeenCalled(); // resumen parcial usa notifySuccess con conteo
  });

  it("notifica error cuando todo falla", async () => {
    aprobarSvc.mockRejectedValue(new Error("nope"));
    const { result } = renderHook(() => useAprobarFacturasLote(), { wrapper: createWrapper() });

    let resumen!: Awaited<ReturnType<typeof result.current.aprobar>>;
    await act(async () => {
      resumen = await result.current.aprobar(["a", "b"]);
    });

    expect(resumen.exitos).toEqual([]);
    expect(resumen.fallos).toHaveLength(2);
    expect(notifyError).toHaveBeenCalled();
  });

  it("resumen vacío cuando ids está vacío y no invoca el servicio", async () => {
    const { result } = renderHook(() => useAprobarFacturasLote(), { wrapper: createWrapper() });
    let resumen!: Awaited<ReturnType<typeof result.current.aprobar>>;
    await act(async () => {
      resumen = await result.current.aprobar([]);
    });
    expect(aprobarSvc).not.toHaveBeenCalled();
    expect(resumen).toEqual({ exitos: [], fallos: [] });
  });
});
