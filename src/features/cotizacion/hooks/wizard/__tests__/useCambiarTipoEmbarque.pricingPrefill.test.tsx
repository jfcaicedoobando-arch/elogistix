import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { useCambiarTipoEmbarque } from "../useCambiarTipoEmbarque";
import { aplicarRespuestaPricing } from "../aplicarRespuestaPricing";
import { COTIZACION_FORM_DEFAULTS, type CotizacionFormValues, type FilaCostoLocal } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";

vi.mock("@/features/costeo/services/topTarifas", () => ({ fetchRecargosDeTarifa: vi.fn() }));
vi.mock("@/features/costeo", () => ({
  etiquetaPuertoCompleta: vi.fn(), origenDe: vi.fn(), destinoDe: vi.fn(),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));

function setup(inicial: Partial<CotizacionFormValues> = {}) {
  const setCostos = vi.fn();
  const hook = renderHook(() => {
    const form = useForm<CotizacionFormValues>({ defaultValues: { ...COTIZACION_FORM_DEFAULTS, ...inicial } });
    const cambiar = useCambiarTipoEmbarque({ form, setCostosInternos: setCostos });
    return { form, cambiar };
  });
  return { ...hook, setCostos };
}

describe("GUI69: conservar precarga al elegir FCL por primera vez", () => {
  it("aplica una respuesta, elige FCL y conserva el contenedor heredado", () => {
    const { result } = setup();
    const tarifa = { id: "tarifa-hc", tipo_contenedor_id: "tipo-hc" } as TopTarifaRow;
    act(() => aplicarRespuestaPricing(result.current.form, tarifa));
    expect(result.current.form.getValues("tipoContenedor")).toBe("tipo-hc");
    expect(result.current.form.getValues("tipoEmbarque")).toBe("");
    act(() => result.current.cambiar("FCL"));
    expect(result.current.form.getValues("tipoContenedor")).toBe("tipo-hc");
    expect(result.current.form.getValues("tarifaId")).toBe("tarifa-hc");
    expect(result.current.form.getValues("numContenedores")).toBe(1);
  });

  it("elegir FCL de nuevo no elimina una selección ya capturada", () => {
    const { result, setCostos } = setup({ tipoEmbarque: "FCL", tipoContenedor: "40' High Cube", tarifaId: "t1" });
    act(() => result.current.cambiar("FCL"));
    expect(result.current.form.getValues("tipoContenedor")).toBe("40' High Cube");
    expect(setCostos).not.toHaveBeenCalled();
  });

  it("sin tarifa no conserva un contenedor residual en la primera elección", () => {
    const { result } = setup({ tipoContenedor: "residual" });
    act(() => result.current.cambiar("FCL"));
    expect(result.current.form.getValues("tipoContenedor")).toBe("");
  });

  it("LCL a FCL limpia el contenedor anterior aunque exista una tarifa residual", () => {
    const { result, setCostos } = setup({ tipoEmbarque: "LCL", tipoContenedor: "LCL", tarifaId: "residual" });
    act(() => result.current.cambiar("FCL"));
    expect(result.current.form.getValues("tipoContenedor")).toBe("");
    const filas = [{ notas: "Auto-cargado desde Flete LCL manual" }, { notas: "Manual" }] as FilaCostoLocal[];
    expect(setCostos.mock.calls[0][0](filas)).toEqual([filas[1]]);
  });

  it.each(["", "FCL"] as const)("%s a LCL limpia tarifa, contenedor y costos automáticos", (anterior) => {
    const { result, setCostos } = setup({ tipoEmbarque: anterior, tipoContenedor: "tipo-hc", tarifaId: "t1", agenteId: "a1", navieraId: "n1" });
    act(() => result.current.cambiar("LCL"));
    expect(result.current.form.getValues("tipoContenedor")).toBe("");
    expect(result.current.form.getValues("tarifaId")).toBeNull();
    expect(result.current.form.getValues("agenteId")).toBeNull();
    expect(result.current.form.getValues("navieraId")).toBeNull();
    const filas = [{ notas: "Auto-cargado desde tarifa marítima" }, { notas: "Manual" }] as FilaCostoLocal[];
    expect(setCostos.mock.calls[0][0](filas)).toEqual([filas[1]]);
  });
});
