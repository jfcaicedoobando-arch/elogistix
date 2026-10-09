/**
 * Tests del controller `useCotizacionWizardSteps`.
 * Mockea servicios `savePaso*` y valida que la navegación entre pasos
 * llama al servicio correcto con los datos del form y maneja errores.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const savePaso1 = vi.fn();
const savePaso2 = vi.fn();
const savePaso3 = vi.fn();
const savePasoFinal = vi.fn();
const notifyError = vi.fn();
const notifySuccess = vi.fn();

vi.mock("@/features/cotizacion/services", async () => ({
  savePaso1: (...a: unknown[]) => savePaso1(...a),
  savePaso2: (...a: unknown[]) => savePaso2(...a),
  savePaso3: (...a: unknown[]) => savePaso3(...a),
  savePasoFinal: (...a: unknown[]) => savePasoFinal(...a),
  buildConceptosFromCostos: (await import("@/features/cotizacion/domain/cotizacion.conceptos")).buildConceptosFromCostos,
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => notifyError(...a),
  notifySuccess: (...a: unknown[]) => notifySuccess(...a),
}));
vi.mock("@/lib/supabase/cast", () => ({ fromDb: <T,>(x: T) => x }));
vi.mock("../handlePaso1Crm", () => ({
  validatePaso1: (v: { clienteId?: string }) => (v.clienteId ? null : "Selecciona un cliente"),
  vincularCrmTrasCrear: vi.fn().mockResolvedValue(undefined),
  campoParaErrorPaso1: (mensaje: string) =>
    mensaje.toLowerCase().includes("cliente") ? "clienteId" : null,
  campoParaPathSchemaPaso1: () => null,
}));

import { useCotizacionWizardSteps } from "../useCotizacionWizardSteps";

function makeDeps(over: Partial<Parameters<typeof useCotizacionWizardSteps>[0]> = {}) {
  const refs = {
    setCurrentStep: vi.fn(),
    setCotizacionId: vi.fn(),
    setConceptosUSD: vi.fn(),
    setConceptosMXN: vi.fn(),
    setCostosPreLlenados: vi.fn(),
    navigate: vi.fn(),
    mutations: {
      crearCotizacion: { mutateAsync: vi.fn().mockResolvedValue({ id: "cot-1" }), isPending: false },
      updateCotizacion: {
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isPending: false,
        selloActual: vi.fn(() => "2026-09-03T11:00:00Z"),
        resincronizarSello: vi.fn(),
      },
      upsertCostos: {
        // v13.823.69: el contrato devuelve { costos, updatedAt } (sello nuevo).
        mutateAsync: vi.fn().mockResolvedValue({ costos: [], updatedAt: "2026-09-03T12:00:00Z" }),
        isPending: false,
      },
      registrarActividad: { mutate: vi.fn() },
    },
  };
  const form = {
    getValues: () => ({ clienteId: "cli-1", esProspecto: false }),
  } as never;
  const deps = {
    form, toast: vi.fn(), navigate: refs.navigate, isEditMode: false,
    cotizacionId: null, setCotizacionId: refs.setCotizacionId,
    currentStep: 1, setCurrentStep: refs.setCurrentStep,
    msdsFile: null, costosInternos: [], costosPreLlenados: false, setCostosPreLlenados: refs.setCostosPreLlenados,
    conceptosUSD: [], conceptosMXN: [], setConceptosUSD: refs.setConceptosUSD, setConceptosMXN: refs.setConceptosMXN,
    totalUSD: 0, tasaIva: 0.16,
    buildPaso1Data: () => ({ foo: "bar" }),
    mutations: refs.mutations,
    ...over,
  } as Parameters<typeof useCotizacionWizardSteps>[0];
  return { deps, refs };
}

beforeEach(() => { vi.clearAllMocks(); savePaso1.mockResolvedValue("cot-1"); savePaso2.mockResolvedValue(undefined); savePaso3.mockResolvedValue(undefined); savePasoFinal.mockResolvedValue(undefined); });

describe("useCotizacionWizardSteps", () => {
  it("handleSiguiente paso 1: si validatePaso1 falla, notifyError y no avanza", async () => {
    const { deps } = makeDeps({
      form: { getValues: () => ({ clienteId: "", esProspecto: false }), setError: vi.fn() } as never,
    });
    const { result } = renderHook(() => useCotizacionWizardSteps(deps));
    await act(async () => { await result.current.handleSiguiente(); });
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({ description: "Selecciona un cliente" }));
    // VF-09/VB-34: además del toast, el campo queda marcado inline.
    expect(deps.form.setError).toHaveBeenCalledWith("clienteId", expect.objectContaining({ message: "Selecciona un cliente" }));
    expect(savePaso1).not.toHaveBeenCalled();
  });

  it("handleSiguiente paso 1 OK: llama savePaso1, setCotizacionId y avanza a 2", async () => {
    const { deps, refs } = makeDeps();
    const { result } = renderHook(() => useCotizacionWizardSteps(deps));
    await act(async () => { await result.current.handleSiguiente(); });
    expect(savePaso1).toHaveBeenCalledTimes(1);
    expect(refs.setCotizacionId).toHaveBeenCalledWith("cot-1");
    expect(refs.setCurrentStep).toHaveBeenCalledWith(2);
  });

  it("handleSiguiente paso 2: con costos prellena conceptos USD/MXN y avanza", async () => {
    const { deps, refs } = makeDeps({
      currentStep: 2, cotizacionId: "cot-1",
      // Q7 (v13.823.396): el dominio exige una fila con importes reales,
      // concepto y proveedor; {id, monto, moneda} ya no es un costo válido.
      costosInternos: [{
        origen_venta_id: "cost-A",
        concepto: "Flete",
        proveedor: "Maersk",
        moneda: "USD",
        cantidad: 1,
        costo_unitario: 100,
        precio_venta: 115,
        unidad_medida: "Servicio",
      }],
    });
    const { result } = renderHook(() => useCotizacionWizardSteps(deps));
    await act(async () => { await result.current.handleSiguiente(); });
    expect(savePaso2).toHaveBeenCalledTimes(1);
    expect(refs.setConceptosUSD).toHaveBeenCalledWith([expect.objectContaining({ origen_costo_id: "cost-A", descripcion: "Flete", moneda: "USD", precio_unitario: 115, total: 115 })]);
    expect(refs.setConceptosMXN).toHaveBeenCalledWith([]);
    expect(refs.setCostosPreLlenados).toHaveBeenCalledWith(true);
    expect(refs.setCurrentStep).toHaveBeenCalledWith(3);
  });

  it("handleSiguiente paso 2: sin costos internos bloquea con notifyError (fix race LCL)", async () => {
    const { deps, refs } = makeDeps({
      currentStep: 2, cotizacionId: "cot-1", costosInternos: [],
    });
    const { result } = renderHook(() => useCotizacionWizardSteps(deps));
    await act(async () => { await result.current.handleSiguiente(); });
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: expect.stringMatching(/costo interno/i) }),
    );
    expect(savePaso2).not.toHaveBeenCalled();
    expect(refs.setCurrentStep).not.toHaveBeenCalled();
  });

  it("handleSiguiente paso 2: re-sincroniza conceptos si `costosInternos` cambió aunque `costosPreLlenados` sea true (fix guard una-sola-vez)", async () => {
    // Simula: usuario avanzó a paso 3 (costosPreLlenados=true), regresó a paso 2,
    // editó costos, y vuelve a avanzar. La firma nueva difiere de la inicial → regenerar.
    const initial = makeDeps({
      currentStep: 2, cotizacionId: "cot-1", costosPreLlenados: true,
      costosInternos: [{ origen_venta_id: "cost-A", concepto: "Flete", proveedor: "Maersk", moneda: "USD", cantidad: 1, costo_unitario: 50, precio_venta: 100, unidad_medida: "Servicio" }],
      conceptosUSD: [{ origen_costo_id: "cost-A", descripcion: "Flete", moneda: "USD", cantidad: 1, precio_unitario: 100, unidad_medida: "Servicio", aplica_iva: true, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 116 }],
    });
    const { result, rerender } = renderHook((deps) => useCotizacionWizardSteps(deps), { initialProps: initial.deps });
    const editados = makeDeps({
      currentStep: 2, cotizacionId: "cot-1", costosPreLlenados: true,
      costosInternos: [{ ...initial.deps.costosInternos[0], precio_venta: 250 }],
      conceptosUSD: initial.deps.conceptosUSD,
    });
    // Reutilizamos los refs originales para verificar setters
    (editados.deps as unknown as { setConceptosUSD: unknown }).setConceptosUSD = initial.refs.setConceptosUSD;
    (editados.deps as unknown as { setConceptosMXN: unknown }).setConceptosMXN = initial.refs.setConceptosMXN;
    (editados.deps as unknown as { setCurrentStep: unknown }).setCurrentStep = initial.refs.setCurrentStep;
    rerender(editados.deps);
    await act(async () => { await result.current.handleSiguiente(); });
    expect(initial.refs.setConceptosUSD).toHaveBeenCalledWith([expect.objectContaining({ origen_costo_id: "cost-A", precio_unitario: 250, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 290 })]);
    expect(initial.refs.setConceptosMXN).toHaveBeenCalledWith([]);
    expect(initial.refs.setCurrentStep).toHaveBeenCalledWith(3);
  });


  it("handleSiguiente paso 3: sin conceptos válidos bloquea con notifyError", async () => {
    const { deps } = makeDeps({ currentStep: 3, cotizacionId: "cot-1" });
    const { result } = renderHook(() => useCotizacionWizardSteps(deps));
    await act(async () => { await result.current.handleSiguiente(); });
    expect(notifyError).toHaveBeenCalledWith(undefined, { title: "Agrega al menos un concepto de venta." });
    expect(savePaso3).not.toHaveBeenCalled();
  });


  it("handleGuardar: éxito navega a /cotizaciones/:id y notifySuccess", async () => {
    const { deps, refs } = makeDeps({ cotizacionId: "cot-1",
      form: { getValues: (key?: string) => key === "sinDesgloseCostos" ? true : { clienteId: "cli-1", esProspecto: false } } as never,
      conceptosUSD: [{ descripcion: "Manual", unidad_medida: "Servicio", cantidad: 1, precio_unitario: 150, moneda: "USD", total: 150, aplica_iva: false }],
    });
    const { result } = renderHook(() => useCotizacionWizardSteps(deps));
    await act(async () => { await result.current.handleGuardar(); });
    expect(savePasoFinal).toHaveBeenCalledTimes(1);
    expect(notifySuccess).toHaveBeenCalled();
    expect(refs.navigate).toHaveBeenCalledWith("/cotizaciones/cot-1");
  });

  it("handleBack en step 1 navega a /cotizaciones", () => {
    const { deps, refs } = makeDeps();
    const { result } = renderHook(() => useCotizacionWizardSteps(deps));
    act(() => { result.current.handleBack(); });
    expect(refs.navigate).toHaveBeenCalledWith("/cotizaciones");
  });

  it("handleBack en step >1 decrementa paso", () => {
    const { deps, refs } = makeDeps({ currentStep: 3 });
    const { result } = renderHook(() => useCotizacionWizardSteps(deps));
    act(() => { result.current.handleBack(); });
    expect(refs.setCurrentStep).toHaveBeenCalledWith(expect.any(Function));
  });
});

it("restaurar baseline protege precio local al volver a paso2 y permite cambios posteriores", async () => {
  const costo: Parameters<typeof useCotizacionWizardSteps>[0]["costosInternos"][number] = { origen_venta_id: "cost-A", concepto: "Flete", proveedor: "Maersk", moneda: "USD", cantidad: 1, costo_unitario: 50, precio_venta: 100, unidad_medida: "Servicio" };
  const venta = { origen_costo_id: "cost-A", descripcion: "Flete", moneda: "USD", cantidad: 1, precio_unitario: 150, unidad_medida: "Servicio", aplica_iva: true, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 174 };
  const initial = makeDeps({ currentStep: 2, cotizacionId: "cot-1", costosInternos: [costo], conceptosUSD: [venta] });
  const { result, rerender } = renderHook(deps => useCotizacionWizardSteps(deps), { initialProps: initial.deps });
  act(() => result.current.restaurarCostosSincronizados([costo]));
  expect(result.current.getCostosSincronizados()).toEqual([costo]);
  await act(async () => result.current.handleSiguiente());
  expect(initial.refs.setConceptosUSD).not.toHaveBeenCalled();
  rerender({ ...initial.deps, costosPreLlenados: true, costosInternos: [{ ...costo, precio_venta: 200 }] });
  await act(async () => result.current.handleSiguiente());
  expect(initial.refs.setConceptosUSD).toHaveBeenCalledWith([expect.objectContaining({ precio_unitario: 200, total: 232 })]);
  expect(result.current.getCostosSincronizados()[0].precio_venta).toBe(200);
});
