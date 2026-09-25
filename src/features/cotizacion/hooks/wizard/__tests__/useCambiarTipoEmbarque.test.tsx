/**
 * P1-3 / P1-4: cambiar FCL↔LCL conserva la clasificación de mercancía y, al
 * desvincular la tarifa, no deja agente/naviera huérfanos en el payload.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { useCambiarTipoEmbarque } from "../useCambiarTipoEmbarque";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

function setup(inicial: Partial<CotizacionFormValues>) {
  const setCostos = vi.fn();
  const setMsds = vi.fn();
  const { result } = renderHook(() => {
    const form = useForm<CotizacionFormValues>({ defaultValues: inicial as CotizacionFormValues });
    const cambiar = useCambiarTipoEmbarque({ form, setCostosInternos: setCostos, setMsdsFile: setMsds });
    return { form, cambiar };
  });
  return { result, setMsds };
}

describe("useCambiarTipoEmbarque", () => {
  it.each(["FCL", "LCL"] as const)("conserva Mercancía Peligrosa y MSDS al cambiar a %s", (destino) => {
    const { result, setMsds } = setup({ tipoEmbarque: destino === "FCL" ? "LCL" : "FCL", tipoCarga: "Mercancía Peligrosa" });
    act(() => result.current.cambiar(destino));
    expect(result.current.form.getValues("tipoCarga")).toBe("Mercancía Peligrosa");
    expect(setMsds).not.toHaveBeenCalled();
  });

  it("FCL con tarifa → LCL limpia tarifa, agente y naviera heredados", () => {
    const { result } = setup({
      tipoEmbarque: "FCL", tarifaId: "t1", agenteId: "a1", agenteNombre: "Chino El Agente",
      navieraId: "n1", navieraNombre: "Maersk", tarifaOverride: {},
    });
    act(() => result.current.cambiar("LCL"));
    const v = result.current.form.getValues();
    expect(v.tarifaId).toBeNull();
    expect(v.agenteId).toBeNull();
    expect(v.navieraId).toBeNull();
    expect(v.tarifaOverride).toEqual({});
  });

  it("sin tarifa vinculada respeta agente/naviera elegidos a mano", () => {
    const { result } = setup({ tipoEmbarque: "FCL", tarifaId: null, agenteId: "a1", navieraId: "n1" });
    act(() => result.current.cambiar("LCL"));
    expect(result.current.form.getValues("agenteId")).toBe("a1");
    expect(result.current.form.getValues("navieraId")).toBe("n1");
  });
});
