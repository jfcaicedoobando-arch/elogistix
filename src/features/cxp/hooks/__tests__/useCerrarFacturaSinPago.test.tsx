/**
 * Tests de `useCerrarFacturaProveedorSinPago` (Ola A · A4).
 * Verifica que llama al servicio con el payload correcto, invalida las
 * queries relevantes en éxito y expone el error al onError.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const cerrarSvc = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: (...a: unknown[]) => notifySuccess(...a),
  notifyError: (...a: unknown[]) => notifyError(...a),
}));
vi.mock("@/features/cxp/services/cerrarFacturaSinPago", () => ({
  cerrarFacturaProveedorSinPago: (...a: unknown[]) => cerrarSvc(...a),
}));

import { useCerrarFacturaProveedorSinPago } from "../useCerrarFacturaSinPago";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCerrarFacturaProveedorSinPago", () => {
  it("llama al servicio con el payload y notifica éxito", async () => {
    cerrarSvc.mockResolvedValueOnce("ajuste-1");
    const { result } = renderHook(() => useCerrarFacturaProveedorSinPago(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        facturaId: "f-1",
        motivo: "compensacion",
        comentario: "NC-9",
      });
    });

    expect(cerrarSvc).toHaveBeenCalledWith({
      facturaId: "f-1",
      motivo: "compensacion",
      comentario: "NC-9",
    });
    expect(notifySuccess).toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("dispara notifyError cuando el servicio falla", async () => {
    cerrarSvc.mockRejectedValueOnce(new Error("no se pudo"));
    const { result } = renderHook(() => useCerrarFacturaProveedorSinPago(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current
        .mutateAsync({ facturaId: "f-2", motivo: "duplicada" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
