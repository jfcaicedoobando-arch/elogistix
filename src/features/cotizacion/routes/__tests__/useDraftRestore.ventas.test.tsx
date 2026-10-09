import { useRef, useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeEach, expect, it, vi } from "vitest";
import { useCotizacionDraftAutosave, draftKey, loadDraft } from "../../hooks/wizard/useCotizacionDraftAutosave";
import { useConceptosVentaCotizacion } from "../../hooks/useConceptosVentaCotizacion";
import { useDraftRestore } from "../useDraftRestore";
import { COTIZACION_FORM_DEFAULTS } from "../../types/formDefaults";
import type { CotizacionFormValues, FilaCostoLocal, ConceptoVentaCotizacion } from "../../types";
import { sincronizarVentasConCostos } from "../../domain/sincronizarVentasConCostos";
import { fetchCotizacionDraftSnapshot } from "../../services/draftSnapshot";
import type { CotizacionDraftSnapshot } from "../../services/draftSnapshot";
vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("../../services/draftSnapshot", () => ({ fetchCotizacionDraftSnapshot: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: vi.fn() }));
const USER = "fixture-user", ORG = "fixture-org", STAMP = "2026-10-07T00:00:00Z";
const COSTO: FilaCostoLocal = { origen_venta_id: "cost-A", concepto: "Flete", proveedor: "Naviera", moneda: "USD", cantidad: 1, costo_unitario: 50, precio_venta: 100, unidad_medida: "Servicio" };
const DERIVADA: ConceptoVentaCotizacion = { clave_sat: "78101800", origen_costo_id: "cost-A", descripcion: "Flete", moneda: "USD", cantidad: 1, precio_unitario: 100, unidad_medida: "Servicio", aplica_iva: true, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 116 };
const SERVER: CotizacionDraftSnapshot = { id: "fixture-quote", organization_id: ORG, updated_at: STAMP, estado: "Borrador", deleted_at: null, embarque_id: null, conceptos_venta: [], tipo_cambio_usd: null };
function useHarness(savedStep2 = false, userId = USER, organizationId = ORG) {
  const form = useForm<CotizacionFormValues>({ defaultValues: { ...COTIZACION_FORM_DEFAULTS, clienteId: savedStep2 ? "client" : "" } });
  const [id, setId] = useState<string | null>(savedStep2 ? SERVER.id : null);
  const [step, setStep] = useState(savedStep2 ? 3 : 1);
  const [costos, setCostos] = useState<FilaCostoLocal[]>(savedStep2 ? [COSTO] : []);
  const baseline = useRef<FilaCostoLocal[]>(savedStep2 ? [COSTO] : []);
  const [tc, setTc] = useState<number | null>(null);
  const ventas = useConceptosVentaCotizacion({ initialUSD: savedStep2 ? [DERIVADA] : undefined });
  const restore = useDraftRestore({ form, userId, organizationId, cotizacionId: id, setCotizacionId: setId, setCurrentStep: setStep, setCostosInternos: setCostos, setConceptosUSD: ventas.setConceptosUSD, setConceptosMXN: ventas.setConceptosMXN, setTipoCambioUsd: setTc, restaurarCostosSincronizados: c => { baseline.current = c; }, resincronizarSello: vi.fn() });
  const autosave = useCotizacionDraftAutosave({ form, userId, organizationId, enabled: true, cotizacionId: id, currentStep: step, costosInternos: costos, conceptosUSD: ventas.conceptosUSD, conceptosMXN: ventas.conceptosMXN, tipoCambioUsd: tc, getCostosSincronizados: () => baseline.current, selloActual: () => STAMP, paused: restore.restaurando || restore.pendienteBorrador });
  return { form, id, setId, step, costos, setCostos, baseline, tc, setTc, ventas, restore, autosave };
}
function saveLocalCapture() {
  const first = renderHook(() => useHarness(true));
  act(() => {
    first.result.current.ventas.actualizarConcepto("USD", 0, "precio_unitario", 150);
    first.result.current.ventas.agregarConceptoPrefill("MXN", { descripcion: "Manual MXN", cantidad: 1, precio_unitario: 10200, unidad_medida: "Servicio", tipo_iva: "no_objeto", aplica_iva: false, tasa_iva_aplicada: 0 });
    first.result.current.setTc(20.4);
  });
  // No flush necesario: las ventas fuera de RHF se persisten inmediatamente.
  expect(loadDraft(USER, ORG)?.conceptosUSD?.[0].precio_unitario).toBe(150);
  first.unmount();
}
beforeEach(() => { window.localStorage.clear(); vi.clearAllMocks(); vi.mocked(fetchCotizacionDraftSnapshot).mockResolvedValue(SERVER); });
it("recupera USD150 + manual MXN10200 NoObjeto, linaje y TC tras dos interrupciones", async () => {
  saveLocalCapture();
  for (let i = 0; i < 2; i++) {
    const h = renderHook(() => useHarness());
    expect(h.result.current.restore.banderaBorrador).toBe(true);
    await act(async () => h.result.current.restore.handleRestore());
    expect(h.result.current.id).toBe(SERVER.id);
    expect(h.result.current.step).toBe(3);
    expect(h.result.current.costos).toEqual([COSTO]);
    expect(h.result.current.ventas.conceptosUSD).toEqual([{ ...DERIVADA, precio_unitario: 150, total: 174 }]);
    expect(h.result.current.ventas.conceptosMXN.find(c => c.descripcion === "Manual MXN")).toMatchObject({ precio_unitario: 10200, total: 10200, tipo_iva: "no_objeto", aplica_iva: false, tasa_iva_aplicada: 0 });
    expect(h.result.current.tc).toBe(20.4);
    h.unmount();
  }
});
it("no revive una venta local eliminada; snapshot vacío gana al servidor viejo", async () => {
  saveLocalCapture();
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  act(() => { h.result.current.ventas.setConceptosUSD([]); h.result.current.ventas.setConceptosMXN([]); });
  h.unmount();
  vi.mocked(fetchCotizacionDraftSnapshot).mockResolvedValue({ ...SERVER, conceptos_venta: [DERIVADA] });
  const reload = renderHook(() => useHarness());
  await act(async () => reload.result.current.restore.handleRestore());
  expect(reload.result.current.ventas.conceptosUSD).toEqual([]);
  expect(reload.result.current.ventas.conceptosMXN).toEqual([]);
});
it("doble Restaurar comparte una carga y una restauración", async () => {
  saveLocalCapture();
  let resolve!: (s: CotizacionDraftSnapshot) => void;
  vi.mocked(fetchCotizacionDraftSnapshot).mockImplementation(() => new Promise(r => { resolve = r; }));
  const h = renderHook(() => useHarness());
  let pending!: Promise<void>;
  act(() => { pending = h.result.current.restore.handleRestore(); void h.result.current.restore.handleRestore(); });
  expect(fetchCotizacionDraftSnapshot).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(SERVER); await pending; });
  await act(async () => h.result.current.restore.handleRestore());
  expect(fetchCotizacionDraftSnapshot).toHaveBeenCalledTimes(1);
  expect(h.result.current.ventas.conceptosUSD).toHaveLength(1);
});
it.each(["discard", "unmount", "tenant", "user", "document"])("ignora lectura tardía después de %s", async action => {
  saveLocalCapture();
  let resolve!: (s: CotizacionDraftSnapshot) => void;
  vi.mocked(fetchCotizacionDraftSnapshot).mockImplementation(() => new Promise(r => { resolve = r; }));
  const h = renderHook(({ user, org }) => useHarness(false, user, org), { initialProps: { user: USER, org: ORG } });
  let pending!: Promise<void>;
  act(() => { pending = h.result.current.restore.handleRestore(); });
  if (action === "discard") act(() => h.result.current.restore.handleDiscard());
  if (action === "unmount") h.unmount();
  if (action === "tenant") h.rerender({ user: USER, org: "other-org" });
  if (action === "user") h.rerender({ user: "other-user", org: ORG });
  if (action === "document") act(() => h.result.current.setId("other-quote"));
  await act(async () => { resolve(SERVER); await pending; });
  expect(h.result.current.ventas.conceptosUSD.some(c => c.precio_unitario === 150)).toBe(false);
  expect(window.localStorage.getItem(draftKey(USER, "other-org"))).toBeNull();
  expect(window.localStorage.getItem(draftKey("other-user", ORG))).toBeNull();
});
it.each([
  null, { ...SERVER, estado: "Cancelada" }, { ...SERVER, deleted_at: STAMP },
  { ...SERVER, estado: "Aceptada" }, { ...SERVER, embarque_id: "emb" },
  { ...SERVER, organization_id: "other" }, { ...SERVER, id: "other" },
  { ...SERVER, updated_at: "2026-10-07T01:00:00Z" },
])("no restaura un documento inválido/cancelado/nuevo: %j", async snapshot => {
  saveLocalCapture();
  const original = window.localStorage.getItem(draftKey(USER, ORG));
  vi.mocked(fetchCotizacionDraftSnapshot).mockResolvedValue(snapshot);
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  await act(async () => h.result.current.restore.handleResincronizar());
  expect(h.result.current.id).toBeNull();
  expect(h.result.current.restore.conflictoSello).toBe(true);
  expect(h.result.current.restore.pendienteBorrador).toBe(true);
  expect(window.localStorage.getItem(draftKey(USER, ORG))).toBe(original);
});
it("un fallo de red permite reintentar sin adoptar otra versión", async () => {
  saveLocalCapture();
  vi.mocked(fetchCotizacionDraftSnapshot).mockRejectedValueOnce(new Error("offline"));
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  expect(h.result.current.id).toBeNull();
  await act(async () => h.result.current.restore.handleResincronizar());
  expect(h.result.current.id).toBe(SERVER.id);
  expect(h.result.current.restore.conflictoSello).toBe(false);
});
it("v3 usa ventas servidor del mismo sello, sin inventar ediciones locales", async () => {
  window.localStorage.setItem(draftKey(USER, ORG), JSON.stringify({ version: 3, savedAt: Date.now(), cotizacionId: SERVER.id, updatedAt: STAMP, values: { clienteId: "client" }, costosInternos: [COSTO], currentStep: 4 }));
  vi.mocked(fetchCotizacionDraftSnapshot).mockResolvedValue({ ...SERVER, conceptos_venta: [DERIVADA], tipo_cambio_usd: 19 });
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  expect(h.result.current.ventas.conceptosUSD).toEqual([DERIVADA]);
  expect(h.result.current.step).toBe(2);
  expect(h.result.current.tc).toBe(19);
  expect(loadDraft(USER, ORG)?.version).toBe(4);
});
it("borrador vinculado sin sello conserva storage y exige datos actuales", async () => {
  saveLocalCapture();
  const stored = JSON.parse(window.localStorage.getItem(draftKey(USER, ORG))!);
  delete stored.updatedAt;
  window.localStorage.setItem(draftKey(USER, ORG), JSON.stringify(stored));
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  expect(h.result.current.restore.conflictoSello).toBe(true);
  expect(h.result.current.id).toBeNull();
});
it("borrar la última venta local sin form/costos no resucita el borrador anterior", () => {
  const h = renderHook(() => useHarness());
  act(() => h.result.current.ventas.setConceptosUSD([DERIVADA]));
  expect(loadDraft(USER, ORG)).not.toBeNull();
  act(() => { h.result.current.ventas.setConceptosUSD([]); h.result.current.ventas.setConceptosMXN([]); });
  expect(loadDraft(USER, ORG)).toBeNull();
});
it("flush durante una restauración pendiente no destruye las ventas locales", async () => {
  saveLocalCapture();
  const original = window.localStorage.getItem(draftKey(USER, ORG));
  const h = renderHook(() => useHarness());
  act(() => { h.result.current.form.setValue("clienteId", "other-client"); h.result.current.autosave.flush(); });
  expect(window.localStorage.getItem(draftKey(USER, ORG))).toBe(original);
  await act(async () => h.result.current.restore.handleRestore());
  expect(h.result.current.form.getValues("clienteId")).toBe("client");
});

it("restaurar conserva el baseline: volver a paso 2 no cambia150 y editar el costo sí regenera", async () => {
  saveLocalCapture();
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  const { costos, baseline, ventas } = h.result.current;
  const unchanged = sincronizarVentasConCostos(costos, baseline.current, [...ventas.conceptosUSD, ...ventas.conceptosMXN], 0.16);
  expect(unchanged.usd[0].precio_unitario).toBe(150);
  const edited = sincronizarVentasConCostos([{ ...costos[0], precio_venta: 200 }], baseline.current, [...ventas.conceptosUSD, ...ventas.conceptosMXN], 0.16);
  expect(edited.usd[0].precio_unitario).toBe(200);
  expect(edited.mxn.find(c => c.descripcion === "Manual MXN")?.precio_unitario).toBe(10200);
});
it("un costo editado pero aún no sincronizado conserva baseline anterior tras reload", async () => {
  saveLocalCapture();
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  act(() => h.result.current.setCostos([{ ...COSTO, precio_venta: 200 }]));
  h.unmount();
  const reload = renderHook(() => useHarness());
  await act(async () => reload.result.current.restore.handleRestore());
  const { costos, baseline, ventas } = reload.result.current;
  expect(baseline.current[0].precio_venta).toBe(100);
  expect(costos[0].precio_venta).toBe(200);
  expect(sincronizarVentasConCostos(costos, baseline.current, ventas.conceptosUSD, 0.16).usd[0].precio_unitario).toBe(200);
});

it("legacy con costos pero sin ventas servidor aún genera al revisar paso2", async () => {
  window.localStorage.setItem(draftKey(USER, ORG), JSON.stringify({ version: 3, savedAt: Date.now(), cotizacionId: SERVER.id, updatedAt: STAMP, values: { clienteId: "client" }, costosInternos: [COSTO], currentStep: 3 }));
  const h = renderHook(() => useHarness());
  await act(async () => h.result.current.restore.handleRestore());
  const { costos, baseline, ventas } = h.result.current;
  expect(ventas.conceptosUSD).toEqual([]);
  expect(baseline.current).toEqual([]);
  expect(sincronizarVentasConCostos(costos, baseline.current, [], 0.16).usd[0].precio_unitario).toBe(100);
});
