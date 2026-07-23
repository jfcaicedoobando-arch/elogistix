/**
 * B.3.5 — Integración Portal Aprobación de Cotización (controller).
 *
 * Ejercita la composición real del controller del portal:
 *   - estado local (acción + comentario)
 *   - mutación `useResponderCotizacion` (mockeando sólo el service RPC)
 *   - notifySuccess / notifyError + reset en ambos paths
 *
 * No mockea el hook de mutación: ejercita el wiring entre el controller,
 * el cliente de React Query y el service `portalResponderCotizacion`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { portalResponderMock, toastFn, notifySuccessMock, notifyErrorMock } = vi.hoisted(() => ({
  portalResponderMock: vi.fn(),
  toastFn: vi.fn(),
  notifySuccessMock: vi.fn(),
  notifyErrorMock: vi.fn(),
}));

vi.mock("@/features/cotizacion/services", () => ({
  portalResponderCotizacion: portalResponderMock,
}));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: toastFn }) }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: notifySuccessMock,
  notifyError: notifyErrorMock,
}));

import { usePortalCotizacionDetalleController } from "../usePortalCotizacionDetalleController";

describe("B.3.5 flujo Portal Aprobación Cotización", () => {
  beforeEach(() => {
    portalResponderMock.mockReset();
    notifySuccessMock.mockReset();
    notifyErrorMock.mockReset();
    toastFn.mockReset();
  });

  it("flujo Aceptada: invoca RPC con args correctos, dispara notifySuccess y resetea estado", async () => {
    portalResponderMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(
      () => usePortalCotizacionDetalleController("cot-99"),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.setConfirmAction("Aceptada");
      result.current.setComentario("Adelante");
    });
    expect(result.current.confirmAction).toBe("Aceptada");

    await act(async () => {
      result.current.handleResponder();
    });

    await waitFor(() => expect(portalResponderMock).toHaveBeenCalledTimes(1));
    expect(portalResponderMock).toHaveBeenCalledWith("cot-99", "Aceptada", "Adelante");

    await waitFor(() => expect(notifySuccessMock).toHaveBeenCalledTimes(1));
    const arg = notifySuccessMock.mock.calls[0][1];
    expect(arg.title).toBe("Tu respuesta fue registrada");
    expect(arg.description).toMatch(/Aceptaste la cotización/);

    // Reset post-éxito.
    expect(result.current.confirmAction).toBeNull();
    expect(result.current.comentario).toBe("");
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });

  it("flujo Rechazada: copy diferenciado y mismo reset", async () => {
    portalResponderMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(
      () => usePortalCotizacionDetalleController("cot-1"),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.setConfirmAction("Rechazada");
      result.current.setComentario("Precio alto");
    });
    await act(async () => {
      result.current.handleResponder();
    });

    await waitFor(() => expect(portalResponderMock).toHaveBeenCalledWith("cot-1", "Rechazada", "Precio alto"));
    await waitFor(() => expect(notifySuccessMock).toHaveBeenCalledTimes(1));
    const arg = notifySuccessMock.mock.calls[0][1];
    expect(arg.title).toBe("Cotización rechazada");
    expect(arg.description).toMatch(/Registramos tu rechazo/);
    expect(result.current.confirmAction).toBeNull();
  });

  it("flujo error: notifyError + reset, sin notifySuccess", async () => {
    portalResponderMock.mockRejectedValueOnce(new Error("rpc-fail"));
    const { result } = renderHook(
      () => usePortalCotizacionDetalleController("cot-x"),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.setConfirmAction("Aceptada");
      result.current.setComentario("ok");
    });
    await act(async () => {
      result.current.handleResponder();
    });

    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledTimes(1));
    const arg = notifyErrorMock.mock.calls[0][1];
    expect(arg.title).toBe("Error");
    expect(arg.description).toBe("rpc-fail");
    expect(notifySuccessMock).not.toHaveBeenCalled();
    expect(result.current.confirmAction).toBeNull();
    expect(result.current.comentario).toBe("");
  });

  it("handleResponder es no-op si no hay confirmAction o cotizacionId", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => usePortalCotizacionDetalleController(id),
      { wrapper: createWrapper(), initialProps: { id: "cot-1" as string | undefined } },
    );

    // Sin confirmAction.
    await act(async () => { result.current.handleResponder(); });
    expect(portalResponderMock).not.toHaveBeenCalled();

    // Con confirmAction pero sin cotizacionId.
    rerender({ id: undefined });
    await act(async () => {
      result.current.setConfirmAction("Aceptada");
    });
    await act(async () => { result.current.handleResponder(); });
    expect(portalResponderMock).not.toHaveBeenCalled();
  });

  it("onDialogOpenChange(false) resetea estado", async () => {
    const { result } = renderHook(
      () => usePortalCotizacionDetalleController("cot-1"),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      result.current.setConfirmAction("Rechazada");
      result.current.setComentario("texto");
    });
    await act(async () => { result.current.onDialogOpenChange(false); });
    expect(result.current.confirmAction).toBeNull();
    expect(result.current.comentario).toBe("");
  });
});
