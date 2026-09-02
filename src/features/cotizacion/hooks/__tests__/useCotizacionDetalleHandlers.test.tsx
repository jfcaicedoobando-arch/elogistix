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
  notifyErrorMock, notifySuccessMock,
  registrarActividadMutate,
  fetchDatosFiscalesMock,
  tieneCostosCargadosMock,
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
  registrarActividadMutate: vi.fn(),
  fetchDatosFiscalesMock: vi.fn(),
  tieneCostosCargadosMock: vi.fn(),
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
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: notifyErrorMock,
  notifySuccess: notifySuccessMock,
  notifyWarning: vi.fn(),
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

  it.each(["Aceptada", "En operación", "Rechazada"])(
    "handleCambiarEstado NO sincroniza desde el cliente en %s (autoridad de la BD)",
    async (estado) => {
      actualizarEstadoMutateAsync.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
      await act(async () => { await result.current.handleCambiarEstado(estado); });
      expect(actualizarEstadoMutateAsync).toHaveBeenCalledWith({ id: "cot-1", estado });
      expect(sincronizarEtapaMock).not.toHaveBeenCalled();
    },
  );

  it("handleCambiarEstado swallow-ea fallas CRM pero NO bloquea el éxito", async () => {
    actualizarEstadoMutateAsync.mockResolvedValue(undefined);
    sincronizarEtapaMock.mockRejectedValue(new Error("crm down"));
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleCambiarEstado("Enviada"); });
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

  it("handleConvertir rechaza si el nombre está vacío", async () => {
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    act(() => result.current.setClienteForm({ ...result.current.clienteForm, nombre: "  " }));
    await act(async () => { await result.current.handleConvertir(); });
    expect(convertirProspectoMutateAsync).not.toHaveBeenCalled();
    expect(notifyErrorMock).toHaveBeenCalled();
  });

  it("handleConvertir crea cliente, propaga CRM y cierra diálogo", async () => {
    convertirProspectoMutateAsync.mockResolvedValue({ id: "cli-1", nombre: "ACME SA" });
    propagarConversionMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCotizacionDetalleHandlers(cot()), { wrapper: createWrapper() });
    await act(async () => { await result.current.abrirDialogConvertir(); });
    await act(async () => { await result.current.handleConvertir(); });
    expect(convertirProspectoMutateAsync).toHaveBeenCalledWith({
      cotizacionId: "cot-1",
      clienteData: expect.objectContaining({ nombre: "ACME" }),
    });
    expect(propagarConversionMock).toHaveBeenCalledWith({
      oportunidadId: "opp-1", clienteId: "cli-1", clienteNombre: "ACME SA",
    });
    expect(result.current.showConvertir).toBe(false);
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
