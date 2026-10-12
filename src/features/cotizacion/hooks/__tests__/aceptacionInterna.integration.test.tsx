import { act, renderHook, waitFor } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";
import type { CotizacionRow } from "@/features/cotizacion/types";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
const feedback = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
const crm = vi.hoisted(() => ({ moneda: vi.fn(), alinear: vi.fn(), sincronizar: vi.fn(), fiscales: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: feedback.success, notifyError: feedback.error, notifyWarning: feedback.warning,
}));
vi.mock("@/hooks/shared", async () => ({
  useMutationWithFeedback: (await import("@/hooks/shared/useMutationWithFeedback")).useMutationWithFeedback,
}));
vi.mock("@/features/cotizacion/services", async () => ({
  updateEstadoCotizacion: (await import("@/features/cotizacion/services/mutations/estado")).updateEstadoCotizacion,
  convertirProspectoACliente: (await import("@/features/cotizacion/services/conversiones/prospecto")).convertirProspectoACliente,
}));
vi.mock("@/features/cotizacion/hooks/useCotizaciones", async () => ({
  useUpdateEstadoCotizacion: (await import("@/features/cotizacion/hooks/mutations/useCotizacionMutations")).useUpdateEstadoCotizacion,
  useConvertirProspectoACliente: (await import("@/features/cotizacion/hooks/useCotizacionConversions")).useConvertirProspectoACliente,
}));
vi.mock("@/features/cotizacion/services/datosFiscalesProspecto", () => ({ fetchDatosFiscalesProspecto: crm.fiscales }));
vi.mock("@/features/cotizacion/hooks/useCrearEmbarqueBorradorHandlers", () => ({ useCrearEmbarqueBorradorHandlers: () => ({}) }));
vi.mock("@/features/crm/services/monedaOportunidad", () => ({
  fetchMonedaOportunidad: crm.moneda, alinearMonedaOportunidad: crm.alinear,
}));
vi.mock("@/features/crm/services/vincularCotizacion", () => ({ sincronizarEtapaPorEstadoCotizacion: crm.sincronizar }));

import { useCotizacionDetalleHandlers } from "../useCotizacionDetalleHandlers";

function montar(oportunidadId: string | null = null, overrides: Partial<CotizacionRow> = {}) {
  const cotizacion = {
    id: "cot-1", estado: "Borrador", cliente_id: "cli-1", es_prospecto: false,
    oportunidad_id: oportunidadId, moneda: "USD", version: 4,
    version_aceptada: null, aceptada_en: null, aceptada_por: null,
    ...overrides,
    // SAFE-CAST: fixture mínimo; la aceptación sólo envía el id y el servidor valida la fila.
  } as unknown as CotizacionRow;
  return renderHook(({ cotizacion }) => ({
    handlers: useCotizacionDetalleHandlers(cotizacion), qc: useQueryClient(),
  }), { wrapper: createWrapper(), initialProps: { cotizacion } });
}

function respuesta(sinCambios = false) {
  mock.setRpcResult("aceptar_cotizacion_version", {
    data: { version_aceptada: 4, origen_aceptacion: "interna_cliente_de_casa", sin_cambios: sinCambios },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.resetResults();
  mock.rpcCalls.length = 0;
  mock.tableCalls.length = 0;
  crm.moneda.mockResolvedValue("USD");
  crm.alinear.mockResolvedValue(true);
  crm.fiscales.mockResolvedValue({});
  respuesta();
});

describe("prospecto Enviada → Aceptar → Convertir original (RPC simuladas)", () => {
  const cliente = { nombre: "ACME", contacto: "Ana", email: "ana@test.local", telefono: "5555555555",
    rfc: "ACM010101AA1", direccion: "Calle 1", ciudad: "CDMX", estado: "CDMX", cp: "06600",
    regimen_fiscal: "601", uso_cfdi_default: "G03", forma_pago_default: "99", metodo_pago_default: "PPD" };

  it("acepta sin convertir prematuramente, reintenta antes/después de la conversión original", async () => {
    const { result, rerender } = montar("opp-1", {
      estado: "Enviada", cliente_id: null, es_prospecto: true, prospecto_empresa: "ACME",
    });
    mock.setRpcResult("aceptar_cotizacion_version", {
      data: { version_aceptada: 4, origen_aceptacion: "aceptacion_prospecto_crm", sin_cambios: false }, error: null,
    });
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(mock.rpcCalls.map((call) => call.fn)).toEqual(["aceptar_cotizacion_version"]);
    expect(feedback.success).toHaveBeenCalledTimes(1);
    // SAFE-CAST: refetch de detalle simulado; los sellos vienen del resultado persistido servidor.
    const aceptada = { id: "cot-1", estado: "Aceptada", cliente_id: null, es_prospecto: true,
      prospecto_empresa: "ACME", oportunidad_id: "opp-1", moneda: "USD", version: 4,
      version_aceptada: 4, aceptada_en: "2026-10-12T10:00:00Z", aceptada_por: "usuario-2" } as unknown as CotizacionRow;
    rerender({ cotizacion: aceptada });
    mock.setRpcResult("aceptar_cotizacion_version", {
      data: { version_aceptada: 4, origen_aceptacion: "aceptacion_prospecto_crm", sin_cambios: true }, error: null,
    });
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(feedback.success).toHaveBeenCalledTimes(2);
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", { data: { cliente_id: "cli-1", nombre: "ACME", creado: true }, error: null });
    await act(async () => { await result.current.handlers.abrirDialogConvertir(); });
    act(() => result.current.handlers.setClienteForm(cliente));
    await act(async () => { await result.current.handlers.handleConvertir(); });
    expect(result.current.handlers.showConvertir).toBe(false);
    expect(feedback.success).toHaveBeenCalledTimes(3);
    rerender({ cotizacion: { ...aceptada, cliente_id: "cli-1", es_prospecto: false } });
    mock.setRpcResult("aceptar_cotizacion_version", {
      data: { version_aceptada: 4, origen_aceptacion: "autorizacion_cliente", sin_cambios: true }, error: null,
    });
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(mock.rpcCalls.map((call) => call.fn)).toEqual([
      "aceptar_cotizacion_version", "aceptar_cotizacion_version",
      "convertir_prospecto_a_cliente_rpc", "aceptar_cotizacion_version",
    ]);
    expect(mock.rpcCalls[2].args).toEqual({ p_cotizacion_id: "cot-1", p_cliente: cliente });
    expect(mock.tableCalls).toEqual([]);
    expect(crm.sincronizar).not.toHaveBeenCalled();
    expect(feedback.success).toHaveBeenCalledTimes(4); // Un aviso por cada operación/reintento explícito.
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it.each(["Borrador", "Solicitada"] as const)("prospecto %s rechazado por la RPC no convierte ni hace UPDATE", async (estado) => {
    const { result } = montar("opp-1", { estado, cliente_id: null, es_prospecto: true, prospecto_empresa: "ACME" });
    mock.setRpcResult("aceptar_cotizacion_version", { data: null, error: { code: "P0001", message: "LC_COTIZACION_ESTADO_INVALIDO" } });
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(mock.rpcCalls.map((call) => call.fn)).toEqual(["aceptar_cotizacion_version"]);
    expect(mock.tableCalls).toEqual([]);
    expect(feedback.error).toHaveBeenCalledTimes(1);
    expect(feedback.success).not.toHaveBeenCalled();
    expect(result.current.handlers.aceptar.open).toBe(true);
  });

  it.each(["LC_CLIENTE_SIN_PERMISO", "LC_ORG_AJENA", "LC_CLIENTE_FISCAL_INCOMPLETO"])("conversión original rechazada %s conserva diálogo sin repetir aceptación", async (message) => {
    const { result } = montar("opp-1", { estado: "Aceptada", cliente_id: null, es_prospecto: true, prospecto_empresa: "ACME" });
    mock.setRpcResult("convertir_prospecto_a_cliente_rpc", { data: null, error: { code: "42501", message } });
    await act(async () => { await result.current.handlers.abrirDialogConvertir(); });
    act(() => result.current.handlers.setClienteForm(cliente));
    await act(async () => { await result.current.handlers.handleConvertir(); });
    expect(result.current.handlers.showConvertir).toBe(true);
    expect(mock.rpcCalls.map((call) => call.fn)).toEqual(["convertir_prospecto_a_cliente_rpc"]);
    expect(mock.tableCalls).toEqual([]);
    expect(feedback.error).toHaveBeenCalledTimes(1);
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it("fiscal incompleto no llega a la RPC ni hace una escritura parcial", async () => {
    const { result } = montar("opp-1", { estado: "Aceptada", cliente_id: null, es_prospecto: true, prospecto_empresa: "ACME" });
    await act(async () => { await result.current.handlers.abrirDialogConvertir(); });
    act(() => result.current.handlers.setClienteForm({ ...cliente, regimen_fiscal: "" }));
    await act(async () => { await result.current.handlers.handleConvertir(); });
    expect(result.current.handlers.showConvertir).toBe(true);
    expect(mock.rpcCalls).toEqual([]);
    expect(mock.tableCalls).toEqual([]);
    expect(feedback.error).toHaveBeenCalledTimes(1);
    expect(feedback.success).not.toHaveBeenCalled();
  });
});

describe("aceptación interna: detalle → mutación → autoridad canónica", () => {
  it.each([null, "opp-1"])("Borrador con oportunidad %s confirma por RPC y emite un solo éxito", async (oportunidadId) => {
    const { result } = montar(oportunidadId);
    const invalidar = vi.spyOn(result.current.qc, "invalidateQueries");
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    expect(mock.rpcCalls).toEqual([]);
    expect(result.current.handlers.aceptar.open).toBe(true);
    if (oportunidadId) await waitFor(() => expect(crm.moneda).toHaveBeenCalledWith(oportunidadId));
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(mock.rpcCalls).toEqual([{ fn: "aceptar_cotizacion_version", args: { p_cotizacion_id: "cot-1" } }]);
    expect(mock.tableCalls).toEqual([]);
    expect(crm.sincronizar).not.toHaveBeenCalled();
    expect(crm.alinear).not.toHaveBeenCalled();
    if (!oportunidadId) expect(crm.moneda).not.toHaveBeenCalled();
    expect(feedback.success).toHaveBeenCalledTimes(1);
    expect(feedback.error).not.toHaveBeenCalled();
    expect(result.current.handlers.aceptar.open).toBe(false);
    for (const queryKey of [
      queryKeys.cotizaciones.all, queryKeys.cotizaciones.detail("cot-1"),
      queryKeys.portal.cotizacion("cot-1"), queryKeys.portal.cotizacionesAll,
      queryKeys.crm.oportunidades.all, queryKeys.crm.higiene.all, queryKeys.crm.dashboardAll,
    ]) expect(invalidar).toHaveBeenCalledWith({ queryKey });
  });

  it("con CRM alinea moneda antes de la RPC y evita el aviso de éxito duplicado", async () => {
    crm.moneda.mockResolvedValue("MXN");
    const { result } = montar("opp-1");
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await waitFor(() => expect(result.current.handlers.aceptar.hayChoqueMoneda).toBe(true));
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(crm.alinear).toHaveBeenCalledWith("opp-1", "USD");
    expect(crm.alinear.mock.invocationCallOrder[0]).toBeLessThan(mock.supabase.rpc.mock.invocationCallOrder[0]);
    expect(mock.rpcCalls).toHaveLength(1);
    expect(feedback.success).toHaveBeenCalledTimes(1);
    expect(crm.sincronizar).not.toHaveBeenCalled();
  });

  it.each([false, "error"])("si alinear falla (%s), no acepta y muestra sólo un error", async (fallo) => {
    crm.moneda.mockResolvedValue("MXN");
    if (fallo === false) crm.alinear.mockResolvedValue(false);
    else crm.alinear.mockRejectedValue(new Error("sin permiso CRM"));
    const { result } = montar("opp-1");
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await waitFor(() => expect(result.current.handlers.aceptar.hayChoqueMoneda).toBe(true));
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(mock.rpcCalls).toEqual([]);
    expect(mock.tableCalls).toEqual([]);
    expect(feedback.error).toHaveBeenCalledTimes(1);
    expect(feedback.success).not.toHaveBeenCalled();
    expect(result.current.handlers.aceptar.open).toBe(true);
  });

  it.each([null, "opp-1"])("reintento idempotente con oportunidad %s no agrega escrituras ni avisos", async (oportunidadId) => {
    const { result } = montar(oportunidadId);
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    respuesta(true);
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(mock.rpcCalls).toEqual(Array(2).fill({ fn: "aceptar_cotizacion_version", args: { p_cotizacion_id: "cot-1" } }));
    expect(mock.tableCalls).toEqual([]);
    expect(feedback.success).toHaveBeenCalledTimes(2); // Una confirmación por intento.
    expect(feedback.error).not.toHaveBeenCalled();
    expect(crm.sincronizar).not.toHaveBeenCalled();
  });

  it("respuesta perdida: reintenta la misma RPC y no fabrica un sello ni duplica bitácora", async () => {
    mock.supabase.rpc.mockRejectedValueOnce(new Error("respuesta perdida"));
    const { result } = montar();
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(result.current.handlers.aceptar.open).toBe(true);
    expect(feedback.error).toHaveBeenCalledTimes(1);
    expect(feedback.success).not.toHaveBeenCalled();
    respuesta(true);
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(mock.supabase.rpc).toHaveBeenCalledTimes(2);
    expect(mock.supabase.rpc).toHaveBeenNthCalledWith(2, "aceptar_cotizacion_version", { p_cotizacion_id: "cot-1" });
    expect(mock.tableCalls).toEqual([]);
    expect(feedback.error).toHaveBeenCalledTimes(1);
    expect(feedback.success).toHaveBeenCalledTimes(1);
    expect(result.current.handlers.aceptar.open).toBe(false);
  });

  it.each([
    ["42501", "LC_NO_AUTORIZADO"], ["42501", "LC_SOD_VIOLATION"],
    ["P0001", "LC_COT_VENCIDA"], ["P0001", "LC_COTIZACION_ACEPTACION_INCONSISTENTE"],
    ["55P03", "LC_COTIZACION_EN_PROCESO"],
  ])("rechazo %s/%s conserva diálogo y emite un error sin fallback", async (code, message) => {
    mock.setRpcResult("aceptar_cotizacion_version", { data: null, error: { code, message } });
    const { result } = montar();
    await act(async () => { await result.current.handlers.handleCambiarEstado("Aceptada"); });
    await act(async () => { await result.current.handlers.aceptar.confirmar(); });
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.tableCalls).toEqual([]);
    expect(feedback.error).toHaveBeenCalledTimes(1);
    expect(feedback.success).not.toHaveBeenCalled();
    expect(result.current.handlers.aceptar.open).toBe(true);
    expect(result.current.handlers.aceptar.enviando).toBe(false);
  });
});
