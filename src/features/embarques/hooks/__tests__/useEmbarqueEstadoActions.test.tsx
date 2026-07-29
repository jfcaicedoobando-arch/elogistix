import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { toastFn, registrarActividadFn, avanzarMutateAsync, reabrirMutateAsync, sonnerSuccess, sonnerError } = vi.hoisted(() => ({
  toastFn: vi.fn(),
  registrarActividadFn: vi.fn(),
  avanzarMutateAsync: vi.fn().mockResolvedValue({}),
  reabrirMutateAsync: vi.fn().mockResolvedValue({}),
  sonnerSuccess: vi.fn(),
  sonnerError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: sonnerSuccess, error: sonnerError, warning: vi.fn(), info: vi.fn(), message: vi.fn() },
}));

vi.mock("@/lib/observability/reportCaughtError", () => ({
  reportCaughtError: vi.fn(),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
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

vi.mock("@/features/embarques/hooks/useDocsFaltantesParaEstado", () => ({
  useDocsFaltantesParaEstado: () => ({ faltantes: [], bloqueante: false, loading: false }),
  esEstadoBloqueante: () => false,
}));

import { useEmbarqueEstadoActions, getSiguienteEstado } from "../useEmbarqueEstadoActions";

const embarque = {
  id: "e-1", modo: "maritimo", tipo: "FCL",
  etd: null, eta: null, estado: "Confirmado", expediente: "EXP-001",
};

describe("getSiguienteEstado", () => {
  it("retorna el siguiente estado concreto en la secuencia oficial", () => {
    // Secuencia oficial v13.303.22 (Llegada deprecada, nuevo orden Arribo→En Aduana):
    // Borrador → Confirmado → En Tránsito → Arribo → En Aduana →
    // Entregado → EIR → Cerrado.
    expect(getSiguienteEstado("Borrador")).toBe("Confirmado");
    expect(getSiguienteEstado("Confirmado")).toBe("En Tránsito");
    expect(getSiguienteEstado("En Tránsito")).toBe("Arribo");
    expect(getSiguienteEstado("Arribo")).toBe("En Aduana");
    expect(getSiguienteEstado("En Aduana")).toBe("Entregado");
    expect(getSiguienteEstado("Entregado")).toBe("EIR");
    expect(getSiguienteEstado("EIR")).toBe("Cerrado");
  });

  it("rescata embarques legacy en Cotización → Confirmado", () => {
    expect(getSiguienteEstado("Cotización")).toBe("Confirmado");
  });

  it("rescata embarques legacy en Llegada → Arribo (v13.303.22)", () => {
    expect(getSiguienteEstado("Llegada")).toBe("Arribo");
  });

  it("resuelve el lateral En Proceso → Arribo (v13.303.22)", () => {
    expect(getSiguienteEstado("En Proceso")).toBe("Arribo");
  });

  it("retorna null para el último estado o un estado desconocido", () => {
    expect(getSiguienteEstado("Cerrado")).toBeNull();
    expect(getSiguienteEstado("inexistente")).toBeNull();
  });
});

describe("useEmbarqueEstadoActions", () => {
  it("handleAvanzarEstado invoca mutateAsync con id y notifica éxito", async () => {
    avanzarMutateAsync.mockClear();
    registrarActividadFn.mockClear();
    sonnerSuccess.mockClear(); sonnerError.mockClear();
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
    expect(sonnerSuccess).toHaveBeenCalled();
  });

  it("handleReabrir invoca mutateAsync de reabrir y notifica", async () => {
    reabrirMutateAsync.mockClear();
    registrarActividadFn.mockClear();
    sonnerSuccess.mockClear(); sonnerError.mockClear();
    const { result } = renderHook(
      () => useEmbarqueEstadoActions({ ...embarque, estado: "Cerrado" } as Parameters<typeof useEmbarqueEstadoActions>[0], "e-1"),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      await result.current.handleReabrir("Motivo de prueba suficientemente largo");
    });
    await waitFor(() => expect(reabrirMutateAsync).toHaveBeenCalledTimes(1));
    expect(reabrirMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ embarqueId: "e-1", usuarioEmail: "u@x.com" }),
    );
    expect(sonnerSuccess).toHaveBeenCalled();
  });

  it("handleAvanzarEstado notifica error cuando mutateAsync falla", async () => {
    avanzarMutateAsync.mockRejectedValueOnce(new Error("boom"));
    sonnerError.mockClear();
    const { result } = renderHook(
      () => useEmbarqueEstadoActions(embarque as Parameters<typeof useEmbarqueEstadoActions>[0], "e-1"),
      { wrapper: createWrapper() },
    );
    await act(async () => {
      await result.current.handleAvanzarEstado();
    });
    await waitFor(() => expect(sonnerError).toHaveBeenCalled());
    const lastTitle = sonnerError.mock.calls.at(-1)?.[0] as string | undefined;
    expect(lastTitle ?? "").toMatch(/Error al cambiar estado/i);
  });
});
