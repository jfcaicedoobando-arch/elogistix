import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
const m = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/services/storage/index", () => ({ uploadFile: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: m.error, notifySuccess: m.success, notifyWarning: vi.fn() }));
vi.mock("@/features/cotizacion/services", async () => {
  const svc = await import("@/features/cotizacion/services/wizard");
  return { savePaso3: svc.savePaso3, savePasoFinal: svc.savePasoFinal };
});
vi.mock("../usePaso1Handlers", () => ({ usePaso1Handlers: () => ({ validarParaFinalizar: async () => true }) }));
vi.mock("../usePaso2Handler", () => ({ usePaso2Handler: () => vi.fn() }));
import { useCotizacionWizardSteps } from "../useCotizacionWizardSteps";
import type { WizardStepsDeps } from "../wizardStepsTypes";
const usd = { descripcion: "Flete marítimo", cantidad: 1, precio_unitario: 1.41, total: 1.41, moneda: "USD", origen_costo_id: "origin-A", unidad_medida: "Contenedor", aplica_iva: false };

function montar(pricing = true, tc: number | null = null) {
  const update = vi.fn().mockResolvedValue("new-stamp"); const setStep = vi.fn(); const registrar = vi.fn();
  const hook = renderHook(({ tipoCambioUsd }) => {
    const form = useForm<CotizacionFormValues>({ defaultValues: { clienteId: "client-A", oportunidadId: "op-A", tarifaId: "tariff-A", pricingSolicitudId: pricing ? "request-A" : null, monedaCrm: "MXN", sinDesgloseCostos: true, esProspecto: false } });
    const deps = { form, currentStep: 3, cotizacionId: "quote-A", setCotizacionId: vi.fn(), isEditMode: true, navigate: vi.fn(), msdsFile: null, costosInternos: [], costosPreLlenados: false, setCostosPreLlenados: vi.fn(), conceptosUSD: [usd], conceptosMXN: [], setConceptosUSD: vi.fn(), setConceptosMXN: vi.fn(), tasaIva: 0.16, totalUSD: 1.41, tipoCambioUsd, setCurrentStep: setStep, buildPaso1Data: vi.fn(), toast: vi.fn(), mutations: { updateCotizacion: { mutateAsync: update, isPending: false }, upsertCostos: { mutateAsync: vi.fn(), isPending: false }, crearCotizacion: { mutateAsync: vi.fn(), isPending: false }, registrarActividad: { mutate: registrar } } } satisfies WizardStepsDeps;
    return { form, ...useCotizacionWizardSteps(deps) };
  }, { initialProps: { tipoCambioUsd: tc } });
  return { ...hook, update, setStep, registrar };
}
beforeEach(() => vi.clearAllMocks());
describe("wizard Pricing paso 3 y final", () => {
  it("sin TC no avanza; captura TC y reintenta el mismo ID conservando origen", async () => {
    const h = montar(); const original = { ...h.result.current.form.getValues() };
    await act(async () => h.result.current.handleSiguiente());
    expect(h.update).not.toHaveBeenCalled(); expect(h.setStep).not.toHaveBeenCalled();
    expect(m.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ description: expect.stringMatching(/tipo de cambio.*paso 3/i) }));
    h.rerender({ tipoCambioUsd: 20 });
    await act(async () => h.result.current.handleSiguiente());
    expect(h.update).toHaveBeenCalledWith({ id: "quote-A", data: { conceptos_venta: [usd], subtotal: 28.2, moneda: "MXN", tipo_cambio_usd: 20 } });
    expect(h.setStep).toHaveBeenCalledWith(4);
    expect(h.result.current.form.getValues()).toEqual(original);
    await act(async () => h.result.current.handleGuardar());
    expect(h.update).toHaveBeenCalledTimes(2); expect(h.update.mock.calls[1]).toEqual(h.update.mock.calls[0]);
    expect(m.success).toHaveBeenCalledTimes(1);
  });
  it("salto al resumen sin TC no muta ni registra éxito", async () => {
    const h = montar(); await act(async () => h.result.current.handleGuardar());
    expect(h.update).not.toHaveBeenCalled(); expect(h.registrar).not.toHaveBeenCalled(); expect(m.success).not.toHaveBeenCalled();
    expect(m.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ description: expect.stringMatching(/tipo de cambio/) }));
  });
  it("sin Pricing mantiene contrato previo", async () => {
    const h = montar(false); await act(async () => h.result.current.handleSiguiente());
    expect(h.update).toHaveBeenCalledWith({ id: "quote-A", data: { conceptos_venta: [usd], subtotal: 1.41, moneda: "USD", tipo_cambio_usd: null } });
  });
});
