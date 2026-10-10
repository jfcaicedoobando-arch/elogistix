import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { COTIZACION_FORM_DEFAULTS, type CotizacionFormValues, type FilaCostoLocal } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import { firmaCapturaPricing } from "../guardarPaso1Pricing";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
const m = vi.hoisted(() => ({ save: vi.fn(), rpc: vi.fn(), notify: vi.fn(), fetch: vi.fn(), recargos: vi.fn(), next: vi.fn(), stamp: vi.fn() }));
vi.mock("@/features/cotizacion/services", () => ({ savePaso1: m.save }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: m.rpc } }));
vi.mock("@/lib/query/queryClient", () => ({ queryClient: {} }));
vi.mock("../resolverPuertosTarifa", () => ({ errorCoherenciaEstricta: () => null }));
vi.mock("../handlePaso1Crm", () => ({ validatePaso1: () => null, vincularCrmTrasCrear: vi.fn(), campoParaPathSchemaPaso1: () => null }));
vi.mock("../scrollToErrorSection", () => ({ scrollAndFocusSection: vi.fn(), seccionParaErrorPaso1: vi.fn(), campoParaErrorPaso1: () => null }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: m.notify, notifyWarning: m.notify }));
vi.mock("@/lib/ui/appFeedback.notices", () => ({ notifyWarning: m.notify }));
vi.mock("@/features/catalogos/hooks", () => ({ useTiposContenedor: () => ({ data: [{ id: "20", name: "20DRY" }, { id: "40", name: "40DRY" }] }) }));
vi.mock("@/features/cotizacion/hooks/useTarifaVinculada", () => ({ useTarifaVinculada: () => ({ data: tarifa }) }));
vi.mock("@/features/cotizacion/services/tarifaVinculada", () => ({ fetchTarifaVinculada: m.fetch }));
vi.mock("@/features/costeo/services/topTarifas", () => ({ fetchRecargosDeTarifa: m.recargos }));
vi.mock("@/features/configuracion/hooks/useConfiguracion", () => ({ useConfigValue: () => 0.15 }));
vi.mock("@/features/proveedor/hooks/useProveedores", () => ({ useProveedoresLite: () => ({ data: [] }) }));
vi.mock("@/features/cotizacion/components/seccionRuta/buildCostosLCLManual", () => ({ buildCostosLCLManual: () => [] }));
vi.mock("@/features/costeo", () => ({ etiquetaPuertoCompleta: () => "Puerto", origenDe: () => null, destinoDe: () => null }));
import { usePaso1Handlers } from "../usePaso1Handlers";
import { useInvalidarTarifaAutomatica } from "../useInvalidarTarifaAutomatica";
import { useCostosAutoSync, type CostosAutoSync } from "../useCostosAutoSync";
import { aplicarRespuestaPricing } from "../aplicarRespuestaPricing";
import { recordarIdentidadPricing } from "../identidadPricing";
import { marcarEditadaAMano, NOTA_AUTO_TARIFA } from "@/features/cotizacion/domain/costosAutoGenerados";
const tarifa = { id: "tarifa", flete_base: 1000, tipo_contenedor_id: "20", tipo_contenedor_nombre: "20DRY", naviera_nombre: "Naviera" } as TopTarifaRow;
const initial: CotizacionFormValues = { ...COTIZACION_FORM_DEFAULTS, modo: "Marítimo", tipoEmbarque: "FCL", incoterm: "FOB", clienteId: "cliente", oportunidadId: "op" };
const response = { oportunidad_id: "op", cliente_id: "cliente", solicitud_id: "sol", tarifa_id: "tarifa", updated_at: "2026-10-09T12:00:00Z", ya_ligada: false };
const automatico: FilaCostoLocal = { concepto: "Flete", cantidad: 1, costo_unitario: 1000, precio_venta: 1150, moneda: "USD", proveedor: "Naviera", unidad_medida: "contenedor", notas: NOTA_AUTO_TARIFA, costeo_tarifa_id: "tarifa" };
const manual: FilaCostoLocal = { ...automatico, concepto: "Local manual", notas: "Manual", costeo_tarifa_id: null };
let current: { form: UseFormReturn<CotizacionFormValues>; filas: FilaCostoLocal[]; handlers: ReturnType<typeof usePaso1Handlers>; sync: CostosAutoSync };
function Costs({ filas, setFilas, form, handlers }: { filas: FilaCostoLocal[]; setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>; form: UseFormReturn<CotizacionFormValues>; handlers: ReturnType<typeof usePaso1Handlers> }) {
  const sync = useCostosAutoSync({ filas, setFilas });
  useEffect(() => { current = { form, filas, handlers, sync }; });
  return null;
}
function Wizard({ costos = [], values = initial }: { costos?: FilaCostoLocal[]; values?: CotizacionFormValues }) {
  const form = useForm<CotizacionFormValues>({ defaultValues: values });
  const [filas, setFilas] = useState(costos);
  useInvalidarTarifaAutomatica({ form, setCostosInternos: setFilas });
  const handlers = usePaso1Handlers({ form, cotizacionId: null, setCotizacionId: vi.fn(), setCurrentStep: m.next, msdsFile: null, buildPaso1Data: () => ({ tarifa_id: form.getValues("tarifaId") }), mutations: { crearCotizacion: { mutateAsync: vi.fn(), isPending: false }, updateCotizacion: { mutateAsync: vi.fn(), isPending: false, resincronizarSello: m.stamp }, registrarActividad: { mutate: vi.fn() } } });
  return <FormProvider {...form}><Costs filas={filas} setFilas={setFilas} form={form} handlers={handlers} /></FormProvider>;
}
function session(org = "org") {
  setAuthSnapshot({ userId: "user", organizationId: org, email: null, organizationName: null, role: "admin", effectiveRole: "admin" });
  syncActiveOrganizationScope({ userId: "user", organizationId: org });
}
function apply(incoterm: string) {
  act(() => {
    aplicarRespuestaPricing(current.form, tarifa, { incoterm, cantidad: 2, servicio: "Marítimo", tipo_carga: "20DRY" });
    recordarIdentidadPricing(current.form, "sol", "org");
  });
}
beforeEach(() => {
  vi.clearAllMocks(); session();
  m.fetch.mockResolvedValue(tarifa); m.recargos.mockResolvedValue([]);
  m.save.mockImplementation(async ({ buildPaso1Data }) => { expect(buildPaso1Data().tarifa_id).toBe("tarifa"); return "cot"; });
  m.rpc.mockResolvedValue({ data: response, error: null });
});
describe("Pricing, invalidación y autosync montados juntos", () => {
  it.each(["CIF", "CFR", "CIP", "CPT", "DAP", "DDP", "DAT", "DPU"])("%s conserva origen exacto y vincula sin costos de flete", async (incoterm) => {
    render(<Wizard />); apply(incoterm);
    expect(current.form.getValues("tarifaId")).toBe("tarifa");
    expect(current.form.getValues("pricingSolicitudId")).toBe("sol");
    expect(current.filas).toEqual([]); expect(m.fetch).not.toHaveBeenCalled();
    await act(async () => { await current.handlers.handlePaso1(); });
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("crm_vincular_cotizacion_cliente_pricing", { p_cotizacion_id: "cot", p_oportunidad_id: "op", p_solicitud_id: "sol", p_tarifa_id: "tarifa" });
    expect(m.next).toHaveBeenCalledWith(2); expect(current.filas).toEqual([]);
  });
  it.each(["FOB", "FAS"])("%s sigue generando costos y respeta cantidad", async (incoterm) => {
    render(<Wizard />); apply(incoterm);
    await waitFor(() => expect(current.filas).toHaveLength(1));
    expect(current.filas[0]).toMatchObject({ cantidad: 2, costo_unitario: 1000, costeo_tarifa_id: "tarifa" });
  });
  it("CIF retira sólo filas automáticas; manuales y editadas permanecen", () => {
    const editada = marcarEditadaAMano(automatico);
    render(<Wizard costos={[automatico, manual, editada]} />); apply("CIF");
    expect(current.filas).toEqual([manual, editada]);
    expect(current.form.getValues("pricingSolicitudId")).toBe("sol");
  });
  it("CIF sin origen Pricing mantiene la desvinculación anterior", () => {
    render(<Wizard costos={[automatico, manual]} />);
    act(() => aplicarRespuestaPricing(current.form, tarifa, { incoterm: "CIF", cantidad: 2, servicio: "Marítimo", tipo_carga: "20DRY" }));
    expect(current.form.getValues("tarifaId")).toBeNull(); expect(current.filas).toEqual([manual]);
  });
  it("cambio de contenedor incompatible invalida también bajo CIF", () => {
    render(<Wizard />); apply("CIF");
    act(() => current.form.setValue("tipoContenedor", "40"));
    expect(current.form.getValues("tarifaId")).toBeNull(); expect(current.form.getValues("pricingSolicitudId")).toBeNull();
  });
  it("cambio de cliente continúa limpiando identidad", () => {
    render(<Wizard />); apply("CIF");
    act(() => current.form.setValue("clienteId", "otro"));
    expect(current.form.getValues("pricingSolicitudId")).toBeNull();
  });
  it("fallo del RPC conserva misma cotización y reintenta sin duplicar", async () => {
    render(<Wizard />); apply("CIF");
    m.rpc.mockResolvedValueOnce({ data: null, error: new Error("timeout") });
    await act(async () => { await current.handlers.handlePaso1(); });
    expect(current.form.getValues("pricingVinculoPendienteId")).toBe("cot");
    await act(async () => { await current.handlers.handlePaso1(); });
    expect(m.save).toHaveBeenCalledTimes(1); expect(m.rpc).toHaveBeenCalledTimes(2); expect(m.next).toHaveBeenCalledOnce();
  });
  it("tenant ajeno no puede guardar ni vincular", async () => {
    render(<Wizard />); apply("CIF"); session("otro");
    await act(async () => { await current.handlers.handlePaso1(); });
    expect(m.save).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled(); expect(m.next).not.toHaveBeenCalled();
  });
  it("restauración de vínculo pendiente CIF conserva firma y sólo reintenta RPC", async () => {
    const pricing: CotizacionFormValues = { ...initial, incoterm: "CIF", tarifaId: "tarifa", tipoContenedor: "20", pricingSolicitudId: "sol", pricingOrigen: { organizationId: "org", clienteId: "cliente", oportunidadId: "op", tarifaId: "tarifa", solicitudId: "sol" } };
    render(<Wizard values={{ ...pricing, pricingVinculoPendienteId: "cot", pricingVinculoPendienteFirma: firmaCapturaPricing(pricing) }} />);
    await act(async () => { await current.handlers.handlePaso1(); });
    expect(m.save).not.toHaveBeenCalled(); expect(m.rpc).toHaveBeenCalledOnce(); expect(m.next).toHaveBeenCalledWith(2);
  });
  it("CIF → FOB → CIF → FOB reactiva sólo el flete aplicable", async () => {
    render(<Wizard />); apply("CIF");
    act(() => current.form.setValue("incoterm", "FOB"));
    await waitFor(() => expect(current.filas).toHaveLength(1));
    act(() => current.form.setValue("incoterm", "CIF"));
    expect(current.filas).toEqual([]);
    act(() => current.form.setValue("incoterm", "FOB"));
    await waitFor(() => expect(current.filas).toHaveLength(1));
    expect(current.form.getValues("pricingSolicitudId")).toBe("sol");
  });
  it("precarga FOB pendiente no repone flete al cambiar a CIF", async () => {
    let resolve!: (value: typeof tarifa) => void;
    m.fetch.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    render(<Wizard />); apply("FOB");
    act(() => current.form.setValue("incoterm", "CIF"));
    await act(async () => { resolve(tarifa); });
    expect(current.filas).toEqual([]); expect(m.recargos).not.toHaveBeenCalled();
    expect(current.form.getValues("pricingSolicitudId")).toBe("sol");
  });
  it("recálculo pendiente no repone flete al cambiar a CIF", async () => {
    render(<Wizard costos={[automatico, manual]} />); apply("FOB");
    expect(current.sync.desajuste).toBe("tarifa_cantidad");
    let resolve!: (value: typeof tarifa) => void;
    m.fetch.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    act(() => current.sync.recalcular());
    act(() => current.form.setValue("incoterm", "CIF"));
    await act(async () => { resolve(tarifa); });
    expect(current.filas).toEqual([manual]); expect(m.recargos).not.toHaveBeenCalled();
  });
  it("consulta tardía no genera costos después de salir del wizard", async () => {
    let resolve!: (value: typeof tarifa) => void;
    m.fetch.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const view = render(<Wizard />); apply("FOB"); view.unmount();
    await act(async () => { resolve(tarifa); });
    expect(m.recargos).not.toHaveBeenCalled();
  });
  it("cambio de tenant y vuelta cancela generación de la sesión anterior", async () => {
    let resolve!: (value: typeof tarifa) => void;
    m.fetch.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    render(<Wizard />); apply("FOB"); session("otro"); session();
    await act(async () => { resolve(tarifa); });
    expect(current.filas).toEqual([]); expect(m.recargos).not.toHaveBeenCalled();
  });

  it("rechazo tardío de la sesión anterior no produce aviso ni restaura costos", async () => {
    let reject!: (error: Error) => void;
    m.fetch.mockReturnValueOnce(new Promise((_r, fail) => { reject = fail; }));
    render(<Wizard />); apply("FOB"); session("otro");
    const avisos = m.notify.mock.calls.length;
    await act(async () => { reject(new Error("late response")); });
    expect(current.filas).toEqual([]); expect(m.notify).toHaveBeenCalledTimes(avisos);
  });

});
