/**
 * Regresión v13.823.158 — estabilización por contenido sin `JSON.parse(...) as`.
 * El reset debe hidratar cuando llegan los datos, pero NO volver a dispararse
 * cuando el padre reconstruye un `initial` con el mismo contenido (refetch).
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTarifaFormReset } from "../useTarifaFormReset";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

describe("useTarifaFormReset", () => {
  it("no vuelve a resetear si el contenido de initial no cambió", () => {
    const onReset = vi.fn();
    const initial: Partial<TarifaInput> = { naviera_proveedor_id: "prov-1" };
    const { rerender } = renderHook(
      ({ ini }: { ini: Partial<TarifaInput> }) =>
        useTarifaFormReset({ open: true, initial: ini, onReset }),
      { initialProps: { ini: initial } },
    );

    expect(onReset).toHaveBeenCalledTimes(1);
    // Mismo contenido, nueva identidad (simula refetch del padre).
    rerender({ ini: { naviera_proveedor_id: "prov-1" } });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("resetea cuando el contenido cambia e inyecta agenteIdFijo", () => {
    const onReset = vi.fn();
    const { rerender } = renderHook(
      ({ ini }: { ini?: Partial<TarifaInput> }) =>
        useTarifaFormReset({ open: true, initial: ini, agenteIdFijo: "ag-9", onReset }),
      { initialProps: { ini: undefined as Partial<TarifaInput> | undefined } },
    );

    expect(onReset).toHaveBeenLastCalledWith({ agente_id: "ag-9" });
    rerender({ ini: { naviera_proveedor_id: "prov-2" } });
    expect(onReset).toHaveBeenLastCalledWith({
      naviera_proveedor_id: "prov-2",
      agente_id: "ag-9",
    });
  });
});
