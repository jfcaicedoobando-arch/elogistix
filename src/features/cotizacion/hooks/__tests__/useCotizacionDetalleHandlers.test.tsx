/**
 * Tests del hook `useCotizacionDetalleHandlers`.
 * Cubre los 4 handlers principales: cambiar estado, convertir prospecto,
 * generar embarques y crear borrador, incluyendo manejo de errores y
 * propagación al CRM.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const {
  navigateMock, toastFn,
  actualizarEstadoMutateAsync, convertirProspectoMutateAsync,
  crearBorradorMutateAsync,
  sincronizarEtapaMock, propagarConversionMock,
  notifyErrorMock, notifySuccessMock, notifyWarningMock,
  registrarActividadMutate,
  fetchDatosFiscalesMock,
  tieneCostosCargadosMock,
  fetchMonedaOportunidadMock,
  alinearMonedaOportunidadMock,
  supabaseCountRef,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  toastFn: vi.fn(),
  actualizarEstadoMutateAsync: vi.fn(),
  convertirProspectoMutateAsync: vi.fn(),
  crearBorradorMutateAsync: vi.fn(),
  sincronizarEtapaMock: vi.fn(),
  propagarConversionMock: vi.fn(),
  notifyErrorMock: vi.fn(),
  notifySuccessMock: vi.fn(),
  notifyWarningMock: vi.fn(),
  registrarActividadMutate: vi.fn(),
  fetchDatosFiscalesMock: vi.fn(),
  tieneCostosCargadosMock: vi.fn(),
  fetchMonedaOportunidadMock: vi.fn(),
  alinearMonedaOportunidadMock: vi.fn(),
  supabaseCountRef: { value: 1 } as { value: number },
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => navigateMock }));
vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: toastFn }),
  useRegistrarActividad: () => ({ mutate: registrarActividadMutate }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count: supabaseCountRef.value, error: null }),
      }),
    }),
  },
}));
vi.mock("@/features/cotizacion/hooks/useCotizaciones", () => ({
  useUpdateEstadoCotizacion: () => ({ mutateAsync: actualizarEstadoMutateAsync }),
  useConvertirProspectoACliente: () => ({ mutateAsync: convertirProspectoMutateAsync, isPending: false }),
  useCrearEmbarqueBorrador: () => ({ mutateAsync: crearBorradorMutateAsync, isPending: false }),
}));
vi.mock("@/features/crm/services/vincularCotizacion", () => ({
  sincronizarEtapaPorEstadoCotizacion: (...a: unknown[]) => sincronizarEtapaMock(...a),
  propagarConversionProspectoCRM: (...a: unknown[]) => propagarConversionMock(...a),
}));
// Servicios de apoyo: el hook los llama al abrir el diálogo y al crear
// borrador; sin mock pegan al cliente Supabase falso y revientan el render.
vi.mock("@/features/cotizacion/services/datosFiscalesProspecto", () => ({
  fetchDatosFiscalesProspecto: (...a: unknown[]) => fetchDatosFiscalesMock(...a),
}));
vi.mock("@/features/cotizacion/services/candadoCostos", () => ({
  tieneCostosCargados: (...a: unknown[]) => tieneCostosCargadosMock(...a),
}));
vi.mock("@/features/crm/services/monedaOportunidad", () => ({
  fetchMonedaOportunidad: (...a: unknown[]) => fetchMonedaOportunidadMock(...a),
  alinearMonedaOportunidad: (...a: unknown[]) => alinearMonedaOportunidadMock(...a),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: notifyErrorMock,
  notifySuccess: notifySuccessMock,
  notifyWarning: notifyWarningMock,
}));

import { useCotizacionDetalleHandlers } from "../useCotizacionDetalleHandlers";

const cot = (over: Record<string, unknown> = {}) => ({
  id: "cot-1", oportunidad_id: "opp-1", num_contenedores: 3,
  prospecto_empresa: "ACME", prospecto_contacto: "Juan",
  prospecto_email: "j@acme.mx", prospecto_telefono: "555",
  ...over,
  // SAFE-CAST: shape mínimo de CotizacionRow requerido por el hook
} as unknown as Parameters<typeof useCotizacionDetalleHandlers>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  supabaseCountRef.value = 1;
  fetchDatosFiscalesMock.mockResolvedValue({});
  tieneCostosCargadosMock.mockResolvedValue(true);
  fetchMonedaOportunidadMock.mockResolvedValue("USD");
  alinearMonedaOportunidadMock.mockResolvedValue(true);
});

describe("useCotizacionDetalleHandlers", () => {
  it("handleCambiarEstado sincroniza la etapa CRM en estados no terminales", async () => {
    actualizarEstadoMutateAsync.mockResolvedValue(undefined);
    sincronizarEtapaMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleCambiarEstado("Enviada"); });
    expect(actualizarEstadoMutateAsync).toHaveBeenCalledWith({ id: "cot-1", estado: "Enviada" });
    expect(sincronizarEtapaMock).toHaveBeenCalledWith({ oportunidadId: "opp-1", estadoCotizacion: "Enviada" });
    // v13.359.1 — el toast lo emite el hook de mutación, no el handler.
    expect(notifySuccessMock).not.toHaveBeenCalled();
  });

  it.each(["En operación", "Rechazada"])(
    "handleCambiarEstado NO sincroniza desde el cliente en %s (autoridad de la BD)",
    async (estado) => {
      actualizarEstadoMutateAsync.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
      await act(async () => { await result.current.handleCambiarEstado(estado); });
      expect(actualizarEstadoMutateAsync).toHaveBeenCalledWith({ id: "cot-1", estado });
      expect(sincronizarEtapaMock).not.toHaveBeenCalled();
    },
  );

  it("Aceptada NO cambia el estado de inmediato: abre la confirmación", async () => {
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleCambiarEstado("Aceptada"); });
    expect(actualizarEstadoMutateAsync).not.toHaveBeenCalled();
    expect(result.current.aceptar.open).toBe(true);
  });

  it("confirmar con la MISMA moneda acepta sin tocar la oportunidad", async () => {
    actualizarEstadoMutateAsync.mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useCotizacionDetalleHandlers(cot({ moneda: "USD" })),
      { wrapper: createWrapper() },
    );
    await act(async () => { await result.current.handleCambiarEstado("Aceptada"); });
    await act(async () => { await result.current.aceptar.confirmar(); });
    expect(alinearMonedaOportunidadMock).not.toHaveBeenCalled();
    expect(actualizarEstadoMutateAsync).toHaveBeenCalledWith({ id: "cot-1", estado: "Aceptada" });
    expect(sincronizarEtapaMock).not.toHaveBeenCalled();
  });

  it("confirmar con moneda distinta alinea la oportunidad antes de aceptar", async () => {
    actualizarEstadoMutateAsync.mockResolvedValue(undefined);
    fetchMonedaOportunidadMock.mockResolvedValue("MXN");
    const { result } = renderHook(
      () => useCotizacionDetalleHandlers(cot({ moneda: "USD" })),
      { wrapper: createWrapper() },
    );
    await act(async () => { await result.current.handleCambiarEstado("Aceptada"); });
    await vi.waitFor(() => expect(result.current.aceptar.hayChoqueMoneda).toBe(true));
    await act(async () => { await result.current.aceptar.confirmar(); });
    expect(alinearMonedaOportunidadMock).toHaveBeenCalledWith("opp-1", "USD");
    expect(actualizarEstadoMutateAsync).toHaveBeenCalledWith({ id: "cot-1", estado: "Aceptada" });
  });

  it("si no se puede alinear la moneda, NO cambia el estado", async () => {
    fetchMonedaOportunidadMock.mockResolvedValue("MXN");
    alinearMonedaOportunidadMock.mockResolvedValue(false);
    const { result } = renderHook(
      () => useCotizacionDetalleHandlers(cot({ moneda: "USD" })),
      { wrapper: createWrapper() },
    );
    await act(async () => { await result.current.handleCambiarEstado("Aceptada"); });
    await vi.waitFor(() => expect(result.current.aceptar.hayChoqueMoneda).toBe(true));
    await act(async () => { await result.current.aceptar.confirmar(); });
    expect(actualizarEstadoMutateAsync).not.toHaveBeenCalled();
    expect(notifyErrorMock).toHaveBeenCalled();
    expect(result.current.aceptar.open).toBe(true);
  });

  it("falla CRM: conserva el estado guardado y advierte sincronización parcial", async () => {
    actualizarEstadoMutateAsync.mockResolvedValue(undefined);
    sincronizarEtapaMock.mockRejectedValue(new Error("crm down"));
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleCambiarEstado("Enviada"); });
    expect(actualizarEstadoMutateAsync).toHaveBeenCalledTimes(1);
    expect(notifyErrorMock).not.toHaveBeenCalled();
    expect(notifyWarningMock).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Estado guardado; el CRM no se actualizó" }),
    );
  });

  it("sincronización CRM exitosa no emite advertencias duplicadas", async () => {
    actualizarEstadoMutateAsync.mockResolvedValue(undefined);
    sincronizarEtapaMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleCambiarEstado("Enviada"); });
    expect(notifyWarningMock).not.toHaveBeenCalled();
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });

  it("abrirDialogConvertir pre-llena clienteForm con datos del prospecto", async () => {
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.abrirDialogConvertir(); });
    expect(result.current.showConvertir).toBe(true);
    expect(result.current.clienteForm).toMatchObject({
      nombre: "ACME", contacto: "Juan", email: "j@acme.mx", telefono: "555",
    });
  });

  // P0 — el formulario exige los datos fiscales completos (espejo de la RPC).
  const FISCALES_OK = {
    nombre: "ACME", contacto: "Juan", email: "j@acme.mx", telefono: "5555555555",
    rfc: "ACM010101AA1", direccion: "Av. Reforma 1", ciudad: "CDMX", estado: "CDMX",
    cp: "06600", regimen_fiscal: "601", uso_cfdi_default: "G03",
    forma_pago_default: "99", metodo_pago_default: "PPD",
  };

  it("handleConvertir rechaza si el nombre está vacío", async () => {
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    act(() => result.current.setClienteForm({ ...FISCALES_OK, nombre: "  " }));
    await act(async () => { await result.current.handleConvertir(); });
    expect(convertirProspectoMutateAsync).not.toHaveBeenCalled();
    expect(notifyErrorMock).toHaveBeenCalled();
  });

  it("handleConvertir rechaza si faltan datos fiscales (no llega a la RPC)", async () => {
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    act(() => result.current.setClienteForm({ ...FISCALES_OK, regimen_fiscal: "" }));
    await act(async () => { await result.current.handleConvertir(); });
    expect(convertirProspectoMutateAsync).not.toHaveBeenCalled();
    expect(notifyErrorMock).toHaveBeenCalled();
  });

  it("handleConvertir hace UNA sola llamada (sin propagación CRM posterior) y cierra", async () => {
    convertirProspectoMutateAsync.mockResolvedValue({ id: "cli-1", nombre: "ACME SA", creado: true, sinCambios: false });
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    act(() => result.current.setClienteForm({ ...FISCALES_OK }));
    await act(async () => { await result.current.handleConvertir(); });
    expect(convertirProspectoMutateAsync).toHaveBeenCalledWith({
      cotizacionId: "cot-1",
      clienteData: expect.objectContaining({ nombre: "ACME", regimen_fiscal: "601" }),
    });
    expect(propagarConversionMock).not.toHaveBeenCalled();
    expect(result.current.showConvertir).toBe(false);
  });

  it("handleConvertir NO cierra el diálogo si la RPC falla", async () => {
    convertirProspectoMutateAsync.mockRejectedValue(new Error("LC_CLIENTE_SIN_PERMISO"));
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.abrirDialogConvertir(); });
    act(() => result.current.setClienteForm({ ...FISCALES_OK }));
    await act(async () => { await result.current.handleConvertir(); });
    expect(result.current.showConvertir).toBe(true);
  });

  // FIX-07 (v13.303.12) — `handleGenerarEmbarques` (path legacy multi-await)
  // se eliminó del hook; toda conversión pasa ahora por `handleCrearBorrador`
  // (RPC transaccional). Ya no hay test para el path removido.

  it("handleCrearBorrador navega al embarque creado", async () => {
    crearBorradorMutateAsync.mockResolvedValue("emb-99");
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleCrearBorrador(); });
    expect(crearBorradorMutateAsync).toHaveBeenCalledWith("cot-1");
    expect(navigateMock).toHaveBeenCalledWith("/embarques/emb-99");
  });

  it("handleCrearBorrador NO navega si falla (el toast lo emite el hook)", async () => {
    crearBorradorMutateAsync.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleCrearBorrador(); });
    expect(notifyErrorMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
