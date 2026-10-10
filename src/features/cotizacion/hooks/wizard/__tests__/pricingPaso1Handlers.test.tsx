import { beforeEach, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { COTIZACION_FORM_DEFAULTS, type CotizacionFormValues } from "@/features/cotizacion/types";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
const m = vi.hoisted(() => ({ save: vi.fn(), rpc: vi.fn(), notify: vi.fn(), validate: vi.fn() }));
vi.mock("@/features/cotizacion/services", () => ({ savePaso1: m.save }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: m.rpc } }));
vi.mock("@/lib/query/queryClient", () => ({ queryClient: {} }));
vi.mock("../resolverPuertosTarifa", () => ({ errorCoherenciaEstricta: () => null }));
vi.mock("../handlePaso1Crm", () => ({ validatePaso1: m.validate, vincularCrmTrasCrear: vi.fn(), campoParaPathSchemaPaso1: () => null }));
vi.mock("../scrollToErrorSection", () => ({ scrollAndFocusSection: vi.fn(), seccionParaErrorPaso1: vi.fn(), campoParaErrorPaso1: () => null }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: m.notify, notifyWarning: m.notify }));
import { usePaso1Handlers } from "../usePaso1Handlers";
const initial: CotizacionFormValues = { ...COTIZACION_FORM_DEFAULTS, clienteId: "cliente", oportunidadId: "op", tarifaId: "tarifa", pricingSolicitudId: "sol", pricingOrigen: { solicitudId: "sol", organizationId: "org", clienteId: "cliente", oportunidadId: "op", tarifaId: "tarifa" } };
const response = { oportunidad_id: "op", cliente_id: "cliente", solicitud_id: "sol", tarifa_id: "tarifa", updated_at: "2026-10-09T12:00:00Z", ya_ligada: true };
function montar() {
  const next = vi.fn(), setId = vi.fn(), stamp = vi.fn();
  const hook = renderHook(() => {
    const form = useForm<CotizacionFormValues>({ defaultValues: initial });
    return { form, ...usePaso1Handlers({ form, cotizacionId: null, setCotizacionId: setId, setCurrentStep: next, msdsFile: null, buildPaso1Data: () => ({}), mutations: { crearCotizacion: { mutateAsync: vi.fn(), isPending: false }, updateCotizacion: { mutateAsync: vi.fn(), isPending: false, resincronizarSello: stamp }, registrarActividad: { mutate: vi.fn() } } }) };
  });
  return { ...hook, next, setId, stamp };
}
beforeEach(() => {
  vi.clearAllMocks();
  setAuthSnapshot({ userId: "user", organizationId: "org", email: null, organizationName: null, role: "admin", effectiveRole: "admin" });
  syncActiveOrganizationScope({ userId: "user", organizationId: "org" });
  m.validate.mockReturnValue(null);
  m.save.mockResolvedValue("cot"); m.rpc.mockResolvedValue({ data: response, error: null });
});
it("doble clic entre ambos botones guarda y vincula una sola vez", async () => {
  const { result, next, stamp } = montar();
  await act(async () => { await Promise.all([result.current.handlePaso1(), result.current.handleCotizarSinDesglose()]); });
  expect(m.save).toHaveBeenCalledTimes(1); expect(m.rpc).toHaveBeenCalledTimes(1); expect(next).toHaveBeenCalledExactlyOnceWith(2); expect(stamp).toHaveBeenCalledWith(response.updated_at);
});
it.each(["handlePaso1", "handleCotizarSinDesglose"] as const)("%s no avanza ante retorno falso y reintenta mismo ID sin guardar", async (handler) => {
  const { result, next, stamp } = montar();
  m.rpc.mockResolvedValueOnce({ data: { ...response, solicitud_id: "otra" }, error: null });
  await act(async () => { await result.current[handler](); });
  expect(next).not.toHaveBeenCalled(); expect(stamp).not.toHaveBeenCalled();
  await act(async () => { result.current.limpiarVinculoCrmError(); });
  await act(async () => { expect(await result.current.validarParaFinalizar()).toBe(false); });
  await act(async () => { await result.current[handler](); });
  expect(m.save).toHaveBeenCalledTimes(1); expect(m.rpc.mock.calls.map((c) => c[1].p_cotizacion_id)).toEqual(["cot", "cot"]);
  expect(next).toHaveBeenCalledExactlyOnceWith(handler === "handlePaso1" ? 2 : 3);
});
it("editar identidad limpia selección no confirmada", () => {
  const { result } = montar();
  act(() => result.current.form.setValue("clienteId", "otro"));
  expect(result.current.form.getValues("pricingSolicitudId")).toBeNull();
  expect(result.current.form.getValues("pricingOrigen")).toBeNull();
});

it("no cambia modo oculto al reintentar por el otro botón", async () => {
  const { result, next } = montar();
  m.rpc.mockResolvedValueOnce({ data: null, error: new Error("timeout") });
  await act(async () => { await result.current.handlePaso1(); });
  await act(async () => { await result.current.handleCotizarSinDesglose(); });
  expect(result.current.form.getValues("sinDesgloseCostos")).toBe(false);
  expect(m.save).toHaveBeenCalledTimes(1); expect(m.rpc).toHaveBeenCalledTimes(1); expect(next).not.toHaveBeenCalled();
  await act(async () => { await result.current.handlePaso1(); });
  expect(next).toHaveBeenCalledExactlyOnceWith(2);
});
it("no avanza ni guarda otra vez con campos editados tras fallo del vínculo", async () => {
  const { result, next } = montar();
  m.rpc.mockResolvedValueOnce({ data: null, error: new Error("timeout") });
  await act(async () => { await result.current.handlePaso1(); });
  act(() => result.current.form.setValue("notas", "edición posterior"));
  await act(async () => { await result.current.handlePaso1(); });
  expect(m.save).toHaveBeenCalledTimes(1); expect(m.rpc).toHaveBeenCalledTimes(1); expect(next).not.toHaveBeenCalled();
});

it("validación temprana de un borrador pendiente también ofrece recuperar captura", async () => {
  const { result, next } = montar();
  m.rpc.mockResolvedValueOnce({ data: null, error: new Error("timeout") });
  await act(async () => { await result.current.handlePaso1(); });
  act(() => result.current.form.setValue("clienteId", ""));
  m.validate.mockReturnValueOnce("Selecciona una empresa.");
  await act(async () => { await result.current.handlePaso1(); });
  expect(next).not.toHaveBeenCalled(); expect(m.save).toHaveBeenCalledTimes(1);
  const action = m.notify.mock.calls.at(-1)![1].action;
  expect(action.label).toBe("Restaurar captura guardada");
  act(() => action.onClick());
  expect(result.current.form.getValues("clienteId")).toBe("cliente");
  await act(async () => { await result.current.handlePaso1(); });
  expect(next).toHaveBeenCalledExactlyOnceWith(2); expect(m.save).toHaveBeenCalledTimes(1);
});
