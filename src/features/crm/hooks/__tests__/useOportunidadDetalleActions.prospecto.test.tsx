/**
 * CRM-COT-01 — una oportunidad sin cliente pero elegible como prospecto abre el
 * cotizador precargado en vez de quedar bloqueada; no se inserta nada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOportunidadDetalleActions } from "@/features/crm/hooks/useOportunidadDetalleActions";

const crearCotMutateAsync = vi.fn(async () => ({ id: "c1", folio: "COT-1", avisoEtapa: null }));
const navigate = vi.fn();
const prospecto = { data: null as unknown, isLoading: false };

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/features/crm/hooks/useCrmProspectoOportunidad", () => ({
  useCrmProspectoOportunidad: () => prospecto,
}));
vi.mock("@/features/crm/hooks", () => ({
  useEliminarOportunidad: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCrearCotizacionDesdeOportunidad: () => ({ mutateAsync: crearCotMutateAsync, isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifyInfo: vi.fn() }));
vi.mock("@/features/crm/lib/crmToast", () => ({ crmToast: { success: vi.fn() } }));

const op = { id: "op1", cliente_id: null, etapa_id: "e1", modo: "Marítimo" };

describe("useOportunidadDetalleActions · prospecto sin cliente", () => {
  beforeEach(() => {
    navigate.mockClear();
    crearCotMutateAsync.mockClear();
    prospecto.data = null;
    prospecto.isLoading = false;
  });

  it("elegible: navega al cotizador con la oportunidad y no inserta", async () => {
    prospecto.data = { kind: "oportunidad", id: "op1", empresa: "ACME", leadId: "l1" };
    const { result } = renderHook(() => useOportunidadDetalleActions(op, []));
    expect(result.current.puedeCotizar).toBe(true);
    await result.current.crearCotizacion();
    expect(navigate).toHaveBeenCalledWith("/cotizaciones/nueva?oportunidad=op1");
    expect(crearCotMutateAsync).not.toHaveBeenCalled();
  });

  it("no elegible: sigue bloqueado con motivo y sin navegar", async () => {
    const { result } = renderHook(() => useOportunidadDetalleActions(op, []));
    expect(result.current.puedeCotizar).toBe(false);
    expect(result.current.motivoNoCotizar).toMatch(/prospecto calificado/i);
    await result.current.crearCotizacion();
    expect(navigate).not.toHaveBeenCalled();
    expect(crearCotMutateAsync).not.toHaveBeenCalled();
  });

  it("con cliente conserva el flujo canónico existente", async () => {
    const { result } = renderHook(() =>
      useOportunidadDetalleActions({ ...op, cliente_id: "cli1" }, []),
    );
    await result.current.crearCotizacion();
    expect(crearCotMutateAsync).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/cotizaciones/c1/editar");
  });
});
