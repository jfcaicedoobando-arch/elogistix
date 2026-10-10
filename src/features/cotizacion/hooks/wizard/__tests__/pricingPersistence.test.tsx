import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { COTIZACION_FORM_DEFAULTS, type CotizacionFormValues } from "@/features/cotizacion/types";
const m = vi.hoisted(() => ({ rpc: vi.fn(), prospecto: vi.fn(), notify: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: m.rpc } }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: m.notify, notifyWarning: m.notify }));
vi.mock("../handlePaso1Crm", () => ({ vincularCrmTrasCrear: m.prospecto }));
import { vincularClientePricing } from "@/features/cotizacion/services/wizard/vincularClientePricing";
import { accionRecuperarCapturaPricing } from "../recuperarCapturaPricing";
import { guardarPaso1Pricing, firmaCapturaPricing } from "../guardarPaso1Pricing";
import { useVinculoCrmPaso1 } from "../useVinculoCrmPaso1";
import { recordarIdentidadPricing, limpiarIdentidadPricingObsoleta } from "../identidadPricing";
import { useCotizacionDraftAutosave } from "../useCotizacionDraftAutosave";
import { loadDraft, draftKey } from "../cotizacionDraftStorage";
import { buildCotizacionDefaultValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
function sesion(org = "org") {
  setAuthSnapshot({ userId: "user", organizationId: org, email: null, organizationName: null, role: "admin", effectiveRole: "admin" });
  syncActiveOrganizationScope({ userId: "user", organizationId: org });
}
const values: CotizacionFormValues = { ...COTIZACION_FORM_DEFAULTS, clienteId: "cliente", oportunidadId: "op", tarifaId: "tarifa", pricingSolicitudId: "sol", pricingOrigen: { solicitudId: "sol", organizationId: "org", clienteId: "cliente", oportunidadId: "op", tarifaId: "tarifa" } };
const response = { oportunidad_id: "op", cliente_id: "cliente", solicitud_id: "sol", tarifa_id: "tarifa", updated_at: "2026-10-09T12:00:00Z", ya_ligada: false };
function montar(initial = values) {
  const sello = vi.fn();
  const hook = renderHook(() => {
    const form = useForm<CotizacionFormValues>({ defaultValues: initial });
    return { form, ...useVinculoCrmPaso1(form, { resincronizarSello: sello }) };
  });
  return { ...hook, sello };
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sesion(); m.rpc.mockResolvedValue({ data: response, error: null }); });
describe("persistencia exacta Pricing", () => {
  it("invoca sólo la firma nueva con los cuatro IDs exactos", async () => {
    expect(await vincularClientePricing("cot", values)).toEqual(response);
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("crm_vincular_cotizacion_cliente_pricing", { p_cotizacion_id: "cot", p_oportunidad_id: "op", p_solicitud_id: "sol", p_tarifa_id: "tarifa" });
  });
  it.each(["oportunidad_id", "cliente_id", "solicitud_id", "tarifa_id"])("rechaza retorno con %s ajeno", async (key) => {
    m.rpc.mockResolvedValue({ data: { ...response, [key]: "otro" }, error: null });
    await expect(vincularClientePricing("cot", values)).rejects.toThrow("misma respuesta");
  });
  it.each([null, {}, { ...response, updated_at: null }, { ...response, updated_at: "no-fecha" }, { ...response, ya_ligada: undefined }])("rechaza respuesta incompleta %j", async (data) => {
    m.rpc.mockResolvedValue({ data, error: null });
    await expect(vincularClientePricing("cot", values)).rejects.toThrow();
  });
  it.each([{ clienteId: "otra" }, { oportunidadId: "otra" }, { tarifaId: "otra" }, { esProspecto: true }, { pricingSolicitudId: null }, { pricingSolicitudId: "otra" }, { pricingOrigen: null }])("identidad capturada distinta impide RPC %j", async (delta) => {
    await expect(vincularClientePricing("cot", { ...values, ...delta })).rejects.toThrow("identidad");
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("cambio tenant antes/durante respuesta bloquea continuidad", async () => {
    sesion("otra"); await expect(vincularClientePricing("cot", values)).rejects.toThrow("identidad");
    expect(m.rpc).not.toHaveBeenCalled(); sesion();
    let resolve!: (v: unknown) => void;
    m.rpc.mockReturnValue(new Promise((r) => { resolve = r; }));
    const p = vincularClientePricing("cot", values); sesion("otra"); resolve({ data: response, error: null });
    await expect(p).rejects.toThrow("cambió el usuario");
  });
  it("fallo y reintento mantienen ID sin duplicar guardado; sello sólo tras confirmar", async () => {
    const { result, sello } = montar(); const guardar = vi.fn().mockResolvedValue("cot");
    let id = "";
    await act(async () => { id = await guardarPaso1Pricing(result.current.form, null, guardar); });
    m.rpc.mockResolvedValueOnce({ data: null, error: new Error("timeout") });
    await act(async () => { expect(await result.current.vincularCrm(id, result.current.form.getValues())).toBe(false); });
    expect(sello).not.toHaveBeenCalled(); expect(result.current.form.getValues("pricingVinculoPendienteId")).toBe("cot");
    await act(async () => { id = await guardarPaso1Pricing(result.current.form, "cot", guardar); expect(await result.current.vincularCrm(id, result.current.form.getValues())).toBe(true); });
    expect(guardar).toHaveBeenCalledTimes(1); expect(m.rpc.mock.calls.map((c) => c[1].p_cotizacion_id)).toEqual(["cot", "cot"]);
    expect(sello).toHaveBeenCalledExactlyOnceWith(response.updated_at); expect(result.current.form.getValues("pricingVinculoPendienteId")).toBeNull();
  });
  it("retorno distinto no confirma ni resincroniza", async () => {
    const { result, sello } = montar(); m.rpc.mockResolvedValue({ data: { ...response, solicitud_id: "otra" }, error: null });
    await act(async () => { expect(await result.current.vincularCrm("cot", values)).toBe(false); });
    expect(sello).not.toHaveBeenCalled(); expect(result.current.vinculoCrmError).toContain("misma respuesta");
  });
  it("edición en vuelo no confirma la nueva captura", async () => {
    const { result, sello } = montar(); let resolve!: (v: unknown) => void;
    m.rpc.mockReturnValue(new Promise((r) => { resolve = r; }));
    await act(async () => { const p = result.current.vincularCrm("cot", values); result.current.form.setValue("clienteId", "otro"); resolve({ data: response, error: null }); expect(await p).toBe(false); });
    expect(sello).not.toHaveBeenCalled();
  });
  it("borrador restaura solicitud y cotización pendiente sólo en su tenant", async () => {
    localStorage.setItem(draftKey("user", "org"), JSON.stringify({ version: 3, savedAt: Date.now(), cotizacionId: "cot", values: { ...values, pricingVinculoPendienteId: "cot", pricingVinculoPendienteFirma: firmaCapturaPricing(values) }, currentStep: 1 }));
    const draft = loadDraft("user", "org"); expect(draft?.values.pricingSolicitudId).toBe("sol"); expect(loadDraft("user", "otra")).toBeNull();
    const { result } = montar(draft!.values); const guardar = vi.fn();
    expect(await guardarPaso1Pricing(result.current.form, draft!.cotizacionId, guardar)).toBe("cot"); expect(guardar).not.toHaveBeenCalled();
  });
  it("limpia origen al cambiar tarifa sin inferir solicitud del histórico", () => {
    const { result } = montar(); act(() => { result.current.form.setValue("tarifaId", "otra"); limpiarIdentidadPricingObsoleta(result.current.form); });
    expect(result.current.form.getValues("pricingSolicitudId")).toBeNull();
    act(() => recordarIdentidadPricing(result.current.form, null, "org")); expect(result.current.form.getValues("pricingOrigen")).toBeNull();
    expect(buildCotizacionDefaultValues().pricingSolicitudId).toBeNull();
  });
  it("reintento histórico acepta y resincroniza el sello ACTUAL tras un guardado intermedio", async () => {
    const { result, sello } = montar();
    const nuevo = "2026-10-09T15:35:00Z";
    m.rpc.mockResolvedValue({ data: { ...response, ya_ligada: true, updated_at: nuevo }, error: null });
    await act(async () => { expect(await result.current.vincularCrm("cot", values)).toBe(true); });
    expect(sello).toHaveBeenCalledExactlyOnceWith(nuevo);
  });
  it("persiste ID pendiente inmediatamente y conserva ventas, FX y costos v4", () => {
    const venta = { descripcion: "Manual", unidad_medida: "Servicio", cantidad: 1, precio_unitario: 20, total: 20, aplica_iva: false, moneda: "MXN" as const };
    const costo = { concepto: "Flete", moneda: "USD" as const, proveedor: "P", cantidad: 1, costo_unitario: 10, precio_venta: 20, unidad_medida: "Servicio", origen_venta_id: "linea-A" };
    const { result } = renderHook(() => {
      const form = useForm<CotizacionFormValues>({ defaultValues: values });
      useCotizacionDraftAutosave({ form, userId: "user", organizationId: "org", enabled: true, cotizacionId: null, currentStep: 1, costosInternos: [], conceptosMXN: [venta], tipoCambioUsd: 20.4, getCostosSincronizados: () => [costo] });
      return form;
    });
    act(() => result.current.setValue("pricingVinculoPendienteId", "cot"));
    const restored = loadDraft("user", "org");
    expect(restored).toMatchObject({ version: 4, userId: "user", organizationId: "org", conceptosMXN: [venta], conceptosUSD: [], tipoCambioUsd: 20.4, costosSincronizados: [costo] });
    expect(restored?.cotizacionId).toBe("cot");
    expect(restored?.values.pricingSolicitudId).toBe("sol");
    expect(restored?.values.pricingOrigen?.solicitudId).toBe("sol");
  });
  it("edición + autosave + recarga ofrece restauración explícita y reintenta sin otro guardado", async () => {
    const original = { ...values, descripcionMercancia: "Guardado", validezPropuesta: new Date("2026-10-30T00:00:00Z") };
    const first = renderHook(() => {
      const form = useForm<CotizacionFormValues>({ defaultValues: original });
      const autosave = useCotizacionDraftAutosave({ form, userId: "user", organizationId: "org", enabled: true, cotizacionId: null, currentStep: 1, costosInternos: [] });
      return { form, autosave, ...useVinculoCrmPaso1(form, {}) };
    });
    const save = vi.fn().mockResolvedValue("cot");
    await act(async () => { await guardarPaso1Pricing(first.result.current.form, null, save); });
    m.rpc.mockResolvedValueOnce({ data: null, error: new Error("timeout") });
    await act(async () => { expect(await first.result.current.vincularCrm("cot", first.result.current.form.getValues())).toBe(false); });
    act(() => { first.result.current.form.setValue("descripcionMercancia", "Edición posterior"); first.result.current.autosave.flush(); });
    first.unmount();
    const draft = loadDraft("user", "org")!;
    expect(draft.values.descripcionMercancia).toBe("Edición posterior");
    const restored = montar(draft.values);
    await act(async () => { expect(await restored.result.current.vincularCrm("cot", restored.result.current.form.getValues())).toBe(false); });
    const options = m.notify.mock.calls.at(-1)![1];
    expect(options.action.label).toBe("Restaurar captura guardada");
    act(() => options.action.onClick());
    expect(restored.result.current.form.getValues("descripcionMercancia")).toBe("Guardado");
    expect(restored.result.current.form.getValues("validezPropuesta")).toEqual(original.validezPropuesta);
    expect(restored.result.current.form.getValues("pricingVinculoPendienteId")).toBe("cot");
    await act(async () => {
      const id = await guardarPaso1Pricing(restored.result.current.form, "cot", save);
      expect(await restored.result.current.vincularCrm(id, restored.result.current.form.getValues())).toBe(true);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(m.rpc.mock.calls.map((c) => c[1].p_solicitud_id)).toEqual(["sol", "sol"]);
  });
  it("acción de recuperación vieja o de otro tenant nunca aplica datos", () => {
    const { result } = montar({ ...values, pricingVinculoPendienteId: "cot", pricingVinculoPendienteFirma: firmaCapturaPricing(values) });
    const action = accionRecuperarCapturaPricing(result.current.form)!;
    act(() => result.current.form.setValue("notas", "actual"));
    sesion("otra"); act(() => action.onClick());
    expect(result.current.form.getValues("notas")).toBe("actual");
    sesion(); const stale = accionRecuperarCapturaPricing(result.current.form)!;
    act(() => { result.current.form.setValue("pricingVinculoPendienteId", "otra"); stale.onClick(); });
    expect(result.current.form.getValues("pricingVinculoPendienteId")).toBe("otra");
  });
  it("captura guardada corrupta no se restaura", () => {
    const { result } = montar({ ...values, pricingVinculoPendienteId: "cot", pricingVinculoPendienteFirma: "{}" });
    act(() => accionRecuperarCapturaPricing(result.current.form)!.onClick());
    expect(result.current.form.getValues("clienteId")).toBe("cliente");
    expect(m.notify.mock.calls.at(-1)![1].title).toBe("No se pudo restaurar la captura Pricing");
  });
  it("prospectos continúan por servicio original sin caller cliente", async () => {
    const { result, sello } = montar({ ...values, esProspecto: true });
    m.prospecto.mockResolvedValue({ oportunidadId: "op", leadId: "lead", updatedAt: "sello", avisoActividad: null });
    await act(async () => { expect(await result.current.vincularCrm("cot", { ...values, esProspecto: true })).toBe(true); });
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.prospecto).toHaveBeenCalledTimes(1); expect(sello).toHaveBeenCalledWith("sello");
  });
});
