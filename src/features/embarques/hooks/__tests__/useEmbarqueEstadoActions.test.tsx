import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
  useRegistrarActividad: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/features/embarques/hooks/useEmbarques", () => ({
  useAvanzarEstadoEmbarque: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useSyncEstadoEmbarque: () => ({ mutate: vi.fn() }),
  calcularEstadoEmbarque: vi.fn().mockReturnValue("Confirmado"),
}));

import { useEmbarqueEstadoActions, getSiguienteEstado } from "../useEmbarqueEstadoActions";

describe("getSiguienteEstado", () => {
  it("retorna el siguiente estado en la secuencia", () => {
    const sig = getSiguienteEstado("Confirmado");
    expect(typeof sig).toBe("string");
    expect(sig).not.toBe("Confirmado");
  });

  it("retorna null para el último estado", () => {
    expect(getSiguienteEstado("Entregado")).toBeNull();
  });
});

describe("useEmbarqueEstadoActions (smoke)", () => {
  it("monta sin errores y expone handleAvanzarEstado", () => {
    const embarque = { id: "e-1", modo: "maritimo", tipo: "FCL", etd: null, eta: null, estado: "Confirmado" };
    const { result } = renderHook(
      () => useEmbarqueEstadoActions(embarque as Parameters<typeof useEmbarqueEstadoActions>[0], "e-1"),
      { wrapper: createWrapper() },
    );
    expect(typeof result.current.handleAvanzarEstado).toBe("function");
  });
});
