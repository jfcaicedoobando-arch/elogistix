import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConceptoVentaCotizacion, FilaCostoLocal } from "@/features/cotizacion/types";
import { firmaCostos } from "../wizardStepsTypes";
const savePaso2 = vi.fn();
const notifyError = vi.fn();
vi.mock("@/features/cotizacion/services", () => ({ savePaso2: (...args: unknown[]) => savePaso2(...args) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: (...args: unknown[]) => notifyError(...args) }));
import { usePaso2Handler } from "../usePaso2Handler";
const anterior: FilaCostoLocal = { origen_venta_id: "cost-A", concepto: "Flete", moneda: "USD", proveedor: "Naviera", cantidad: 1, costo_unitario: 10, precio_venta: 100, unidad_medida: "Servicio" };
const venta: ConceptoVentaCotizacion = { origen_costo_id: "cost-A", descripcion: "Mi descripción", moneda: "USD", cantidad: 3, precio_unitario: 150, unidad_medida: "Caja", aplica_iva: true, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 522 };
function fixture() {
  return {
    cotizacionId: "cot-A", costosInternos: [{ ...anterior, precio_venta: 200 }], costosAnteriores: { current: [anterior] },
    conceptosUSD: [venta], conceptosMXN: [], costosDesajuste: null, costosPreLlenados: true,
    setCostosPreLlenados: vi.fn(), setConceptosUSD: vi.fn(), setConceptosMXN: vi.fn(), setCurrentStep: vi.fn(), tasaIva: 0.16,
    lastCostosHash: { current: firmaCostos([anterior]) },
    updateCotizacion: { mutateAsync: vi.fn(), isPending: false, selloActual: () => "2026-10-07T01:00:00Z", resincronizarSello: vi.fn() },
    upsertCostos: { mutateAsync: vi.fn(), isPending: false },
  };
}
beforeEach(() => { vi.resetAllMocks(); savePaso2.mockResolvedValue("2026-10-07T02:00:00Z"); });
describe("Audit145: interrumpir y repetir guardado de costos", () => {
  it("un fallo no cambia venta/snapshot; reintentar conserva ajustes e impuestos", async () => {
    savePaso2.mockRejectedValueOnce(new Error("LC_CONFLICTO_CONCURRENCIA"));
    const deps = fixture();
    const { result } = renderHook(() => usePaso2Handler(deps));
    await act(async () => result.current());
    expect(deps.setConceptosUSD).not.toHaveBeenCalled();
    expect(deps.setCurrentStep).not.toHaveBeenCalled();
    expect(deps.costosAnteriores.current).toEqual([anterior]);
    expect(deps.lastCostosHash.current).toBe(firmaCostos([anterior]));
    await act(async () => result.current());
    expect(deps.setConceptosUSD).toHaveBeenCalledExactlyOnceWith([{ ...venta, precio_unitario: 200, total: 696 }]);
    expect(deps.updateCotizacion.resincronizarSello).toHaveBeenCalledWith("2026-10-07T02:00:00Z");
    expect(deps.costosAnteriores.current).toEqual(deps.costosInternos);
  });
  it("mientras guarda no cambia venta; repetir avance no genera ni sobrescribe filas", async () => {
    let finalizar!: (value: string) => void;
    savePaso2.mockReturnValueOnce(new Promise<string>(resolve => { finalizar = resolve; }));
    const deps = fixture();
    const { result } = renderHook(() => usePaso2Handler(deps));
    let pendiente!: Promise<void>;
    act(() => { pendiente = result.current(); });
    expect(deps.setConceptosUSD).not.toHaveBeenCalled();
    await act(async () => { finalizar("2026-10-07T02:00:00Z"); await pendiente; });
    await act(async () => result.current());
    expect(deps.setConceptosUSD).toHaveBeenCalledTimes(1);
    expect(deps.setConceptosMXN).toHaveBeenCalledExactlyOnceWith([]);
    expect(deps.setCurrentStep).toHaveBeenCalledTimes(2);
  });
});
