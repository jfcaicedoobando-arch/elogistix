/**
 * v13.823.107 — acciones del detalle de oportunidad:
 * si eliminar o crear cotización falla no se duplica el aviso de error
 * (useEliminarOportunidad y useCrearCotizacionDesdeOportunidad ya notifican
 * en onError). Se conservan navegación, toast de éxito con folio y el
 * notifyInfo cuando existe avisoEtapa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOportunidadDetalleActions } from "@/features/crm/hooks/useOportunidadDetalleActions";

const eliminarMutateAsync = vi.fn(async (_id: string) => ({}));
const crearCotMutateAsync = vi.fn(async (_input: unknown) => ({ id: "c1", folio: "COT-1", avisoEtapa: null as string | null }));
const navigate = vi.fn();
const notifyError = vi.fn();
const notifyInfo = vi.fn();
const successToast = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));
vi.mock("@/features/crm/hooks", () => ({
  useEliminarOportunidad: () => ({ mutateAsync: eliminarMutateAsync, isPending: false }),
  useCrearCotizacionDesdeOportunidad: () => ({ mutateAsync: crearCotMutateAsync, isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifyInfo: (...args: unknown[]) => notifyInfo(...args),
}));
vi.mock("@/features/crm/lib/crmToast", () => ({
  crmToast: { success: (...args: unknown[]) => successToast(...args) },
}));

const op = { id: "op1", etapa_id: "e1", modo: "FCL" };

describe("useOportunidadDetalleActions", () => {
  beforeEach(() => {
    eliminarMutateAsync.mockClear();
    crearCotMutateAsync.mockClear();
    navigate.mockClear();
    notifyError.mockClear();
    notifyInfo.mockClear();
    successToast.mockClear();
  });

  it("eliminar con éxito notifica y navega", async () => {
    const { result } = renderHook(() => useOportunidadDetalleActions(op, []));
    await result.current.handleEliminar();
    expect(successToast).toHaveBeenCalledWith("Oportunidad eliminada");
    expect(navigate).toHaveBeenCalledWith("/crm/oportunidades");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("oportunidad: si eliminar falla no repite el aviso ni navega", async () => {
    eliminarMutateAsync.mockRejectedValueOnce(new Error("tiene cotizaciones"));
    const { result } = renderHook(() => useOportunidadDetalleActions(op, []));
    await result.current.handleEliminar();
    expect(notifyError).not.toHaveBeenCalled();
    expect(successToast).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("crear cotización con éxito muestra folio y navega al editor", async () => {
    const { result } = renderHook(() => useOportunidadDetalleActions(op, []));
    await result.current.crearCotizacion();
    expect(successToast).toHaveBeenCalledWith("Cotización creada · COT-1");
    expect(navigate).toHaveBeenCalledWith("/cotizaciones/c1/editar");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("con avisoEtapa usa notifyInfo en lugar del toast de éxito", async () => {
    crearCotMutateAsync.mockResolvedValueOnce({ id: "c1", folio: "COT-1", avisoEtapa: "sin etapa Cotizando" });
    const { result } = renderHook(() => useOportunidadDetalleActions(op, []));
    await result.current.crearCotizacion();
    expect(notifyInfo).toHaveBeenCalledTimes(1);
    expect(successToast).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/cotizaciones/c1/editar");
  });

  it("si crear cotización falla no repite el aviso ni navega", async () => {
    crearCotMutateAsync.mockRejectedValueOnce(new Error("RPC denegada"));
    const { result } = renderHook(() => useOportunidadDetalleActions(op, []));
    await result.current.crearCotizacion();
    expect(notifyError).not.toHaveBeenCalled();
    expect(successToast).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
