import { setAuthSnapshot, syncAuthSessionUser } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope, captureAuthDataScope } from "@/lib/auth/authOperationScope";
function sesion(organizationId = "org", userId = "usuario") {
  setAuthSnapshot({ userId, organizationId, email: null, organizationName: null, role: "admin", effectiveRole: "admin" });
  syncActiveOrganizationScope({ organizationId, userId });
}
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
const m = vi.hoisted(() => ({ resolver: vi.fn(), notify: vi.fn(), recargos: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/features/cotizacion/services/contextoPricingCotizacion", () => ({ fetchContextoPricingCotizacion: m.resolver }));
vi.mock("@/features/costeo/services/topTarifas", () => ({ fetchRecargosDeTarifa: m.recargos }));
vi.mock("@/features/costeo", () => ({ etiquetaPuertoCompleta: () => "Puerto", origenDe: () => null, destinoDe: () => null }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: m.notify, notifySuccess: m.notify }));
import { cotizaciones } from "@/features/cotizacion/queryKeys";
import { usePrefillContextoPricing } from "../usePrefillContextoPricing";
import { aplicarRespuestaPricing } from "../aplicarRespuestaPricing";
import { usarOpcionPricing } from "../usarOpcionPricing";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { OpcionPricingCotizacion } from "@/features/cotizacion/services/opcionesPricingCotizacion";
const tarifa = { id: "tarifa", tipo_contenedor_id: "tipo", tipo_contenedor_nombre: "40 HC", vigente_hasta: "2026-10-20" } as TopTarifaRow;
const solicitud = { incoterm: "FOB", cantidad: 3, servicio: "Marítimo", tipo_carga: "40 HC" };
const destinatario = { clienteId: "cliente", oportunidadId: "op", moneda: "USD", etapaNombre: "En negociación", prospecto: null };
const contexto = { organizationId: "org", tarifa, solicitud, destinatario };
const opcion = { organizationId: "org", ...solicitud, solicitudId: "sol", solicitudFolio: "SOL-1", oportunidadId: "op", clienteId: "cliente", tarifa } satisfies OpcionPricingCotizacion;
function wrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function montar(enabled = true, initial: Partial<CotizacionFormValues> = {}, client?: QueryClient) {
  return renderHook(({ id = "tarifa", active = enabled }: { id?: string; active?: boolean }) => {
    const form = useForm<CotizacionFormValues>({ defaultValues: { clienteId: "", oportunidadId: "", leadId: "", tarifaId: null, tipoEmbarque: "FCL", numContenedores: 1, incoterm: "EXW", validezPropuesta: new Date(2026, 10, 20), ...initial } });
    const prefill = usePrefillContextoPricing({ form, tarifaId: id, oportunidadId: "op", solicitudId: "sol", organizationId: "org", enabled: active });
    return { form, prefill };
  }, { initialProps: {}, wrapper: wrapper(client) });
}
beforeEach(() => { sesion(); m.resolver.mockReset().mockResolvedValue(contexto); m.notify.mockReset(); m.recargos.mockReset(); });
describe("transferencia de respuesta Pricing", () => {
  it.each(["FAS", "DPU"])("transfiere el literal %s admitido por el catálogo sin sustituirlo", async (incoterm) => {
    m.resolver.mockResolvedValue({ ...contexto, solicitud: { ...solicitud, incoterm } });
    const { result } = montar();
    await waitFor(() => expect(result.current.prefill.estado).toBe("aplicado"));
    expect(result.current.form.getValues("incoterm")).toBe(incoterm);
  });
  it.each(["UNKNOWN", "FUTURE"])("rechaza Incoterm %s antes de aplicar datos directamente", (incoterm) => {
    const { result } = montar(false);
    const antes = structuredClone(result.current.form.getValues());
    expect(() => aplicarRespuestaPricing(result.current.form, tarifa, { ...solicitud, incoterm })).toThrow(`El Incoterm ${incoterm}`);
    expect(result.current.form.getValues()).toEqual(antes);
    expect(m.recargos).not.toHaveBeenCalled();
  });
  it.each(["UNKNOWN", "FUTURE"])("URL con %s avisa sin aplicar empresa, oportunidad ni tarifa", async (incoterm) => {
    m.resolver.mockResolvedValue({ ...contexto, solicitud: { ...solicitud, incoterm } });
    const { result } = montar();
    const antes = structuredClone(result.current.form.getValues());
    await waitFor(() => expect(result.current.prefill.estado).toBe("error"));
    expect(result.current.form.getValues()).toEqual(antes);
    expect(result.current.form.getValues("pricingOrigen")).toBeUndefined();
    expect(m.notify).toHaveBeenCalledExactlyOnceWith(undefined, expect.objectContaining({ error: expect.objectContaining({ message: expect.stringContaining(`El Incoterm ${incoterm}`) }) }));
  });
  it.each(["UNKNOWN", "FUTURE"])("selección con %s rechaza sin mutar y permite elegir otra respuesta válida", async (incoterm) => {
    m.resolver.mockResolvedValue({ ...contexto, solicitud: { ...solicitud, incoterm } });
    const { result } = montar(false, { clienteId: "cliente" });
    const antes = structuredClone(result.current.form.getValues());
    await expect(usarOpcionPricing(result.current.form, opcion)).rejects.toThrow(`El Incoterm ${incoterm}`);
    expect(result.current.form.getValues()).toEqual(antes);
    m.resolver.mockResolvedValue(contexto);
    await act(async () => usarOpcionPricing(result.current.form, opcion));
    expect(result.current.form.getValues()).toMatchObject({ oportunidadId: "op", tarifaId: "tarifa", incoterm: "FOB" });
  });
  it("normaliza un Incoterm soportado y no inventa uno para enlaces sin solicitud", () => {
    const { result } = montar(false);
    act(() => aplicarRespuestaPricing(result.current.form, tarifa, { ...solicitud, incoterm: " fob " }));
    expect(result.current.form.getValues("incoterm")).toBe("FOB");
    act(() => aplicarRespuestaPricing(result.current.form, tarifa, null));
    expect(result.current.form.getValues("incoterm")).toBe("FOB");
  });

  it("nueva sesión del mismo usuario revoca selección pendiente", async () => {
    syncAuthSessionUser("usuario", "sesion-1");
    let resolver!: (value: typeof contexto) => void;
    m.resolver.mockReturnValue(new Promise((r) => { resolver = r; }));
    const { result } = montar(false, { clienteId: "cliente" });
    const pending = usarOpcionPricing(result.current.form, opcion);
    act(() => syncAuthSessionUser("usuario", "sesion-2")); resolver(contexto);
    await expect(pending).rejects.toThrow("cambió el usuario o la organización");
    expect(result.current.form.getValues("tarifaId")).toBeNull();
  });

  it("cache stale no se aplica antes de revalidar y conserva formulario si la respuesta fue cancelada", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(cotizaciones.contextoPricing(captureAuthDataScope(), "op", "sol", "tarifa"), contexto);
    let rechazar!: (error: Error) => void;
    m.resolver.mockReturnValue(new Promise((_, reject) => { rechazar = reject; }));
    const { result } = montar(true, {}, client);
    expect(result.current.form.getValues("tarifaId")).toBeNull();
    expect(result.current.prefill.isLoading).toBe(true);
    await act(async () => rechazar(new Error("Solicitud cancelada")));
    await waitFor(() => expect(result.current.prefill.estado).toBe("error"));
    expect(result.current.form.getValues("clienteId")).toBe("");
    expect(result.current.form.getValues("tarifaId")).toBeNull();
  });
  it("volver al tenant original no revive el prefill de una generación anterior", async () => {
    const resolvers: ((value: typeof contexto) => void)[] = [];
    m.resolver.mockImplementation(() => new Promise((r) => resolvers.push(r)));
    const { result } = montar();
    act(() => sesion("otra-org"));
    act(() => sesion("org"));
    await act(async () => resolvers[0](contexto));
    expect(result.current.form.getValues("tarifaId")).toBeNull();
    expect(m.resolver.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const resolve of resolvers.slice(1, -1)) await act(async () => resolve(contexto));
    expect(result.current.form.getValues("tarifaId")).toBeNull();
    await act(async () => resolvers.at(-1)!(contexto));
    await waitFor(() => expect(result.current.prefill.estado).toBe("aplicado"));
  });

  it("cambio de organización invalida selección pendiente aunque la captura siga idéntica", async () => {
    let resolver!: (value: typeof contexto) => void;
    m.resolver.mockReturnValue(new Promise((r) => { resolver = r; }));
    const { result } = montar(false, { clienteId: "cliente" });
    const pending = usarOpcionPricing(result.current.form, opcion);
    act(() => sesion("otra-org")); resolver(contexto);
    await expect(pending).rejects.toThrow("cambió el usuario o la organización");
    expect(result.current.form.getValues("tarifaId")).toBeNull();
  });
  it("cambio de usuario invalida selección pendiente", async () => {
    let resolver!: (value: typeof contexto) => void;
    m.resolver.mockReturnValue(new Promise((r) => { resolver = r; }));
    const { result } = montar(false, { clienteId: "cliente" });
    const pending = usarOpcionPricing(result.current.form, opcion);
    act(() => sesion("org", "otro-usuario")); resolver(contexto);
    await expect(pending).rejects.toThrow("cambió el usuario o la organización");
    expect(result.current.form.getValues("tarifaId")).toBeNull();
  });
  it("última selección gana incluso cuando la anterior responde primero", async () => {
    const resolvers: ((value: typeof contexto) => void)[] = [];
    m.resolver.mockImplementation(() => new Promise((r) => resolvers.push(r)));
    const { result } = montar(false, { clienteId: "cliente" });
    const primera = usarOpcionPricing(result.current.form, opcion);
    const segunda = usarOpcionPricing(result.current.form, { ...opcion, solicitudId: "sol-2" });
    resolvers[0](contexto); await expect(primera).rejects.toThrow("reemplazada");
    expect(result.current.form.getValues("tarifaId")).toBeNull();
    resolvers[1]({ ...contexto, solicitud: { ...solicitud, cantidad: 5, incoterm: "CIF" } });
    await act(async () => segunda);
    expect(result.current.form.getValues()).toMatchObject({ numContenedores: 5, incoterm: "CIF" });
  });

  it("aplica empresa real, oportunidad, Incoterm SOL, cantidad y validez una sola vez", async () => {
    const { result, rerender } = montar();
    await waitFor(() => expect(result.current.prefill.estado).toBe("aplicado"));
    expect(result.current.form.getValues()).toMatchObject({ clienteId: "cliente", esProspecto: false, oportunidadId: "op", monedaCrm: "USD", tarifaId: "tarifa", incoterm: "FOB", numContenedores: 3 });
    const validezPropuesta = result.current.form.getValues("validezPropuesta");
    if (!(validezPropuesta instanceof Date)) throw new Error("Falta la fecha de validez de la propuesta");
    expect(validezPropuesta.getMonth()).toBe(9);
    rerender({}); expect(m.resolver).toHaveBeenCalledTimes(1); expect(m.recargos).not.toHaveBeenCalled();
  });
  it("conserva prospecto y hereda SOL sobre ICP", async () => {
    m.resolver.mockResolvedValue({ ...contexto, destinatario: { ...destinatario, clienteId: "", prospecto: { id: "op", leadId: "lead", empresa: "Prospecto", contacto: "Ana", email: "a@b.test", telefono: "1", icpIncoterm: "EXW", icpFrecuencia: "Mensual" } } });
    const { result } = montar(); await waitFor(() => expect(result.current.prefill.estado).toBe("aplicado"));
    expect(result.current.form.getValues()).toMatchObject({ esProspecto: true, clienteId: "", leadId: "lead", prospectoEmpresa: "Prospecto", incoterm: "FOB" });
  });
  it("no consulta ni aplica mientras hay borrador/restauración", async () => {
    const { result, rerender } = montar(false); expect(m.resolver).not.toHaveBeenCalled();
    act(() => result.current.form.reset({ clienteId: "borrador", tarifaId: "capturada" }));
    rerender({ active: true }); await waitFor(() => expect(result.current.prefill.estado).toBe("captura-conservada"));
    expect(result.current.form.getValues("clienteId")).toBe("borrador");
  });
  it("edición durante consulta no permite aplicación tardía", async () => {
    let resolver!: (value: typeof contexto) => void;
    m.resolver.mockReturnValue(new Promise((r) => { resolver = r; }));
    const { result } = montar();
    act(() => result.current.form.setValue("incoterm", "CIF", { shouldDirty: true }));
    await act(async () => resolver(contexto));
    expect(result.current.form.getValues("incoterm")).toBe("CIF"); expect(result.current.form.getValues("tarifaId")).toBeNull();
  });
  it("cambio de URL no aplica resultado anterior", async () => {
    let resolver!: (value: typeof contexto) => void;
    m.resolver.mockImplementation(({ tarifaId }) => tarifaId === "tarifa" ? new Promise((r) => { resolver = r; }) : Promise.reject(new Error("Otra URL")));
    const { result, rerender } = montar(); rerender({ id: "otra" });
    await waitFor(() => expect(result.current.prefill.estado).toBe("error"));
    await act(async () => resolver(contexto)); expect(result.current.form.getValues("tarifaId")).toBeNull();
  });
  it("consulta fallida termina con aviso y sin aplicación parcial", async () => {
    m.resolver.mockRejectedValue(new Error("Solicitud cancelada"));
    const { result } = montar(); await waitFor(() => expect(result.current.prefill.estado).toBe("error"));
    expect(m.notify).toHaveBeenCalledTimes(1); expect(result.current.form.getValues("clienteId")).toBe("");
  });
  it.each([
    { cantidad: null }, { cantidad: 0 }, { cantidad: 1.5 }, { servicio: "Aéreo" }, { tipo_carga: null }, { tipo_carga: "Otro" },
  ])("no inventa contenedores con contexto insuficiente %j", (cambio) => {
    const { result } = montar(false);
    act(() => aplicarRespuestaPricing(result.current.form, tarifa, { ...solicitud, ...cambio }));
    expect(result.current.form.getValues("numContenedores")).toBe(1);
  });
  it("no convierte LCL ni alarga fecha menor", () => {
    const { result } = montar(false, { tipoEmbarque: "LCL", validezPropuesta: new Date(2026, 9, 1) });
    act(() => aplicarRespuestaPricing(result.current.form, tarifa, solicitud));
    expect(result.current.form.getValues()).toMatchObject({ tipoEmbarque: "LCL", numContenedores: 1, validezPropuesta: new Date(2026, 9, 1) });
  });
  it("selección de empresa revalida solicitud y conserva cantidad exacta", async () => {
    const { result } = montar(false, { clienteId: "cliente" });
    await act(async () => usarOpcionPricing(result.current.form, opcion));
    expect(m.resolver).toHaveBeenCalledWith({ organizationId: "org", solicitudId: "sol", oportunidadId: "op", tarifaId: "tarifa" });
    expect(result.current.form.getValues()).toMatchObject({ oportunidadId: "op", numContenedores: 3, incoterm: "FOB" });
  });
  it("rechaza opción ajena sin consulta", async () => {
    const { result } = montar(false, { clienteId: "otro" });
    await expect(usarOpcionPricing(result.current.form, opcion)).rejects.toThrow("no corresponde"); expect(m.resolver).not.toHaveBeenCalled();
  });
  it("selección no pisa cambios realizados mientras revalida", async () => {
    let resolver!: (value: typeof contexto) => void;
    m.resolver.mockReturnValue(new Promise((r) => { resolver = r; }));
    const { result } = montar(false, { clienteId: "cliente" });
    const pending = usarOpcionPricing(result.current.form, opcion);
    act(() => result.current.form.setValue("clienteId", "otro")); resolver(contexto);
    await expect(pending).rejects.toThrow("captura cambió"); expect(result.current.form.getValues("tarifaId")).toBeNull();
  });
});
