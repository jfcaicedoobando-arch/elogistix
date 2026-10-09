import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeEach, expect, it, vi } from "vitest";
import { useCotizacionDraftAutosave, draftKey } from "../../hooks/wizard/useCotizacionDraftAutosave";
import { useConceptosVentaCotizacion } from "../../hooks/useConceptosVentaCotizacion";
import { useCotizacionWizardSteps } from "../../hooks/wizard/useCotizacionWizardSteps";
import { useDraftRestore } from "../useDraftRestore";
import { COTIZACION_FORM_DEFAULTS } from "../../types/formDefaults";
import type { CotizacionFormValues, FilaCostoLocal, ConceptoVentaCotizacion } from "../../types";
import { fetchCotizacionDraftSnapshot } from "../../services/draftSnapshot";
vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("../../services/draftSnapshot", () => ({ fetchCotizacionDraftSnapshot: vi.fn() }));
vi.mock("@/features/cotizacion/services", async () => await import("../../services/wizard"));
vi.mock("../../hooks/wizard/resolverPuertosTarifa", () => ({ errorCoherenciaEstricta: vi.fn(async () => null) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }));
const USER = "final-user", ORG = "final-org", STAMP = "2026-10-07T00:00:00Z";
const COSTO: FilaCostoLocal = { origen_venta_id: "cost-A", concepto: "Flete", proveedor: "Naviera", moneda: "USD", cantidad: 1, costo_unitario: 50, precio_venta: 100, unidad_medida: "Servicio" };
const BASE: ConceptoVentaCotizacion = { origen_costo_id: "cost-A", descripcion: "Flete", moneda: "USD", cantidad: 1, precio_unitario: 100, unidad_medida: "Servicio", aplica_iva: true, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 116 };
let backend: Record<string, unknown>;
const update = vi.fn(async ({ data }: { id: string; data: Record<string, unknown> }) => { Object.assign(backend, data); return STAMP; });
const finalized = vi.fn();
function useHarness(initial = false) {
  const form = useForm<CotizacionFormValues>({ defaultValues: { ...COTIZACION_FORM_DEFAULTS, clienteId: initial ? "client" : "", modo: initial ? "Aéreo" : "", tipo: "Importación", incoterm: "FOB", descripcionMercancia: "Carga", origen: "MEX", destino: "BOG" } });
  const [id, setId] = useState<string | null>(initial ? "quote" : null);
  const [step, setStep] = useState(initial ? 3 : 1);
  const [costos, setCostos] = useState<FilaCostoLocal[]>(initial ? [COSTO] : []);
  const [prellenados, setPrellenados] = useState(initial);
  const [tc, setTc] = useState<number | null>(20.4);
  const ventas = useConceptosVentaCotizacion({ initialUSD: initial ? [BASE] : undefined });
  const steps = useCotizacionWizardSteps({ form, navigate: vi.fn(), toast: vi.fn(), isEditMode: false, cotizacionId: id, setCotizacionId: setId, currentStep: step, setCurrentStep: setStep, msdsFile: null, costosInternos: costos, costosPreLlenados: prellenados, setCostosPreLlenados: setPrellenados, conceptosUSD: ventas.conceptosUSD, conceptosMXN: ventas.conceptosMXN, setConceptosUSD: ventas.setConceptosUSD, setConceptosMXN: ventas.setConceptosMXN, totalUSD: ventas.totalUSD, tasaIva: 0.16, tipoCambioUsd: tc, buildPaso1Data: () => ({}), onFinalized: finalized, mutations: {
    crearCotizacion: { mutateAsync: vi.fn(), isPending: false }, upsertCostos: { mutateAsync: vi.fn().mockResolvedValue({ updatedAt: STAMP }), isPending: false }, registrarActividad: { mutate: vi.fn() }, updateCotizacion: { mutateAsync: update, isPending: false, selloActual: () => STAMP },
  } });
  const restore = useDraftRestore({ form, userId: USER, organizationId: ORG, cotizacionId: id, setCotizacionId: setId, setCurrentStep: setStep, setCostosInternos: setCostos, setConceptosUSD: ventas.setConceptosUSD, setConceptosMXN: ventas.setConceptosMXN, setTipoCambioUsd: setTc, restaurarCostosSincronizados: steps.restaurarCostosSincronizados, resincronizarSello: vi.fn() });
  useCotizacionDraftAutosave({ form, userId: USER, organizationId: ORG, enabled: true, cotizacionId: id, currentStep: step, costosInternos: costos, conceptosUSD: ventas.conceptosUSD, conceptosMXN: ventas.conceptosMXN, tipoCambioUsd: tc, getCostosSincronizados: steps.getCostosSincronizados, selloActual: () => STAMP, paused: restore.restaurando || restore.pendienteBorrador });
  return { form, id, step, setStep, setCostos, setTc, ventas, restore, steps };
}
function capture() {
  const h = renderHook(() => useHarness(true));
  act(() => {
    h.result.current.ventas.actualizarConcepto("USD", 0, "precio_unitario", 150);
    h.result.current.ventas.agregarConceptoPrefill("MXN", { descripcion: "Manual MXN", cantidad: 1, precio_unitario: 10200, unidad_medida: "Servicio", tipo_iva: "no_objeto", aplica_iva: false, tasa_iva_aplicada: 0 });
  });
  h.unmount();
}
async function restoreToSummary() {
  capture();
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  act(() => h.result.current.setStep(4));
  return h;
}
beforeEach(() => {
  window.localStorage.clear(); vi.clearAllMocks();
  backend = { conceptos_venta: [BASE], estado: "Borrador" };
  update.mockImplementation(async ({ data }) => { Object.assign(backend, data); return STAMP; });
  vi.mocked(fetchCotizacionDraftSnapshot).mockResolvedValue({ id: "quote", organization_id: ORG, updated_at: STAMP, estado: "Borrador", deleted_at: null, embarque_id: null, conceptos_venta: [BASE], tipo_cambio_usd: 20.4 });
});
it("restaurar→saltar a resumen→Guardar persiste150/manual exactos en una escritura", async () => {
  const h = await restoreToSummary();
  await act(async () => h.result.current.steps.handleGuardar());
  expect(backend.conceptos_venta).toEqual([
    { ...BASE, precio_unitario: 150, total: 174 },
    expect.objectContaining({ descripcion: "Manual MXN", moneda: "MXN", precio_unitario: 10200, tipo_iva: "no_objeto", total: 10200 }),
  ]);
  expect(update).toHaveBeenCalledTimes(1);
  expect(finalized).toHaveBeenCalledOnce();
});

it.each(["cliente", "proveedor", "costo_sin_guardar", "venta_vacia", "venta_negativa"])("saltar al resumen no omite validación: %s", async tipo => {
  const h = await restoreToSummary();
  act(() => {
    if (tipo === "cliente") h.result.current.form.setValue("clienteId", "");
    if (tipo === "proveedor") h.result.current.setCostos([{ ...COSTO, proveedor: "" }]);
    if (tipo === "costo_sin_guardar") h.result.current.setCostos([{ ...COSTO, costo_unitario: 75 }]);
    if (tipo === "venta_vacia") { h.result.current.ventas.setConceptosUSD([]); h.result.current.ventas.setConceptosMXN([]); }
    if (tipo === "venta_negativa") h.result.current.ventas.actualizarConcepto("USD", 0, "precio_unitario", -150);
  });
  await act(async () => h.result.current.steps.handleGuardar());
  expect(update).not.toHaveBeenCalled();
  expect(finalized).not.toHaveBeenCalled();
  expect(h.result.current.step).toBe(tipo === "cliente" ? 1 : tipo.startsWith("venta") ? 3 : 2);
  expect(backend.conceptos_venta).toEqual([BASE]);
});
it("sin TC mixto no guarda ventas ni confirma el estado", async () => {
  const h = await restoreToSummary();
  act(() => h.result.current.setTc(null));
  await act(async () => h.result.current.steps.handleGuardar());
  expect(update).not.toHaveBeenCalled();
  expect(finalized).not.toHaveBeenCalled();
  expect(h.result.current.ventas.conceptosUSD[0].precio_unitario).toBe(150);
});
it("conflicto/rechazo de servidor conserva las ventas locales y el borrador para reintentar", async () => {
  const h = await restoreToSummary();
  const stored = window.localStorage.getItem(draftKey(USER, ORG));
  update.mockRejectedValueOnce(new Error("LC_CONFLICTO_CONCURRENCIA"));
  await act(async () => h.result.current.steps.handleGuardar());
  expect(update).toHaveBeenCalledOnce();
  expect(finalized).not.toHaveBeenCalled();
  expect(backend.conceptos_venta).toEqual([BASE]);
  expect(window.localStorage.getItem(draftKey(USER, ORG))).toBe(stored);
  await act(async () => h.result.current.steps.handleGuardar());
  expect(finalized).toHaveBeenCalledOnce();
  expect(backend.conceptos_venta).toEqual(expect.arrayContaining([expect.objectContaining({ precio_unitario: 150 }), expect.objectContaining({ precio_unitario: 10200 })]));
});
it("doble Guardar mientras la escritura espera produce una sola actualización", async () => {
  const h = await restoreToSummary();
  let resolve!: (s: string) => void;
  update.mockImplementationOnce(({ data }) => new Promise(r => { resolve = s => { Object.assign(backend, data); r(s); }; }));
  let first!: Promise<void>, second!: Promise<void>;
  act(() => { first = h.result.current.steps.handleGuardar(); second = h.result.current.steps.handleGuardar(); });
  await waitFor(() => expect(update).toHaveBeenCalledOnce());
  expect(finalized).not.toHaveBeenCalled();
  await act(async () => { resolve(STAMP); await Promise.all([first, second]); });
  expect(update).toHaveBeenCalledOnce();
  expect(finalized).toHaveBeenCalledOnce();
});
it("flujo normal Paso3→Siguiente→Guardar usa el mismo snapshot y una escritura final", async () => {
  capture();
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  await act(async () => h.result.current.steps.handleSiguiente());
  expect(h.result.current.step).toBe(4);
  expect(update).toHaveBeenCalledOnce();
  const sales = backend.conceptos_venta;
  update.mockClear();
  await act(async () => h.result.current.steps.handleGuardar());
  expect(update).toHaveBeenCalledOnce();
  expect(backend.conceptos_venta).toEqual(sales);
  expect(finalized).toHaveBeenCalledOnce();
});

it("guardar cambio sólo de costo interno actualiza baseline sin pisar venta local", async () => {
  const h = await restoreToSummary();
  act(() => h.result.current.setCostos([{ ...COSTO, costo_unitario: 75 }]));
  await act(async () => h.result.current.steps.handleGuardar());
  expect(h.result.current.step).toBe(2);
  await act(async () => h.result.current.steps.handleSiguiente());
  expect(h.result.current.step).toBe(3);
  expect(h.result.current.steps.getCostosSincronizados()[0].costo_unitario).toBe(75);
  expect(h.result.current.ventas.conceptosUSD[0].precio_unitario).toBe(150);
  act(() => h.result.current.setStep(4));
  await act(async () => h.result.current.steps.handleGuardar());
  expect(update).toHaveBeenCalledOnce();
  expect(finalized).toHaveBeenCalledOnce();
});
