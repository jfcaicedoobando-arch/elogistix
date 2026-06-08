import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { toastFn, registrarActividadFn, avanzarMutateAsync, reabrirMutateAsync } = vi.hoisted(() => ({
  toastFn: vi.fn(),
  registrarActividadFn: vi.fn(),
  avanzarMutateAsync: vi.fn().mockResolvedValue({}),
  reabrirMutateAsync: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "u@x.com" } }),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: toastFn }),
  useRegistrarActividad: () => ({ mutate: registrarActividadFn }),
}));

vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  useAvanzarEstadoEmbarque: () => ({ mutateAsync: avanzarMutateAsync, isPending: false }),
  useReabrirEmbarque: () => ({ mutateAsync: reabrirMutateAsync, isPending: false }),
  useSyncEstadoEmbarque: () => ({ mutate: vi.fn() }),
  calcularEstadoEmbarque: vi.fn().mockReturnValue("Confirmado"),
}));

vi.mock("@/features/embarques/hooks/useEmbarqueQueries", () => ({
  useEmbarqueConceptosVenta: () => ({ data: [] }),
}));

import { useEmbarqueEstadoActions, getSiguienteEstado } from "../useEmbarqueEstadoActions";

const embarque = {
  id: "e-1", modo: "maritimo", tipo: "FCL",
  etd: null, eta: null, estado: "Confirmado", expediente: "EXP-001",
};

describe("getSiguienteEstado", () => {
  it("retorna el siguiente estado en la secuencia", () => {
    expect(typeof getSiguienteEstado("Confirmado")).toBe("string");
    expect(getSiguienteEstado("Confirmado")).not.toBe("Confirmado");
  });

  it("retorna null para el último estado", () => {
    expect(getSiguienteEstado("Cerrado")).toBeNull();
  });
});

describe("useEmbarqueEstadoActions", () => {
  it("handleAvanzarEstado invoca mutateAsync con id y notifica éxito", async () => {
    avanzarMutateAsync.mockClear();
    registrarActividadFn.mockClear();
    toastFn.mockClear();
    const { result } = renderHook(
      () => useEmbarqueEstadoActions(embarque as Parameters<typeof useEmbarqueEstadoActions>[0], "e-1"),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      await result.current.handleAvanzarEstado();
    });
    await waitFor(() => expect(avanzarMutateAsync).toHaveBeenCalledTimes(1));
    expect(avanzarMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ embarqueId: "e-1", usuarioEmail: "u@x.com" }),
    );
    expect(registrarActividadFn).toHaveBeenCalledWith(
      expect.objectContaining({ accion: "cambiar_estado", entidad_id: "e-1" }),
    );
    expect(toastFn).toHaveBeenCalled();
  });

  it("handleReabrir invoca mutateAsync de reabrir y notifica", async () => {
    reabrirMutateAsync.mockClear();
    registrarActividadFn.mockClear();
    toastFn.mockClear();
    const { result } = renderHook(
      () => useEmbarqueEstadoActions({ ...embarque, estado: "Cerrado" } as Parameters<typeof useEmbarqueEstadoActions>[0], "e-1"),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      await result.current.handleReabrir();
    });
    await waitFor(() => expect(reabrirMutateAsync).toHaveBeenCalledTimes(1));
    expect(reabrirMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ embarqueId: "e-1", usuarioEmail: "u@x.com" }),
    );
    expect(toastFn).toHaveBeenCalled();
  });

  it("handleAvanzarEstado notifica error cuando mutateAsync falla", async () => {
    avanzarMutateAsync.mockRejectedValueOnce(new Error("boom"));
    toastFn.mockClear();
    const { result } = renderHook(
      () => useEmbarqueEstadoActions(embarque as Parameters<typeof useEmbarqueEstadoActions>[0], "e-1"),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      await result.current.handleAvanzarEstado();
    });
    await waitFor(() => expect(toastFn).toHaveBeenCalled());
    const lastArg = toastFn.mock.calls.at(-1)?.[0] as { title?: string } | undefined;
    expect(lastArg?.title ?? "").toMatch(/Error al cambiar estado/i);
  });
});
