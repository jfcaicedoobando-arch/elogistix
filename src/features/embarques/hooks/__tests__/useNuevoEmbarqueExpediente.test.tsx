import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNuevoEmbarqueExpediente } from "../useNuevoEmbarqueExpediente";

describe("useNuevoEmbarqueExpediente", () => {
  it("cambia el modo de expediente y limpia selección", () => {
    const methods = { setValue: vi.fn() };
    const { result } = renderHook(() => useNuevoEmbarqueExpediente({
      methods: methods as any,
      clienteId: "cli-1",
    }));

    expect(result.current.modoExpediente).toBe("nuevo");

    act(() => {
      result.current.handleModoExpedienteChange("existente");
    });
    expect(result.current.modoExpediente).toBe("existente");

    act(() => {
      result.current.handleSeleccionarExpediente({ id: "exp-1", bl_master: "BL1" } as any);
    });
    expect((result.current.expedienteSeleccionado as any)?.id).toBe("exp-1");
    expect(methods.setValue).toHaveBeenCalledWith("blMaster", "BL1");
  });

  it("resetea al cambiar de cliente", () => {
    const methods = { setValue: vi.fn() };
    const { result, rerender } = renderHook(({ clienteId }) => useNuevoEmbarqueExpediente({
      methods: methods as any,
      clienteId,
    }), { initialProps: { clienteId: "cli-1" } });

    act(() => {
      result.current.handleModoExpedienteChange("existente");
    });

    rerender({ clienteId: "cli-2" });
    expect(result.current.modoExpediente).toBe("nuevo");
    expect(result.current.expedienteSeleccionado).toBeNull();
  });
});
