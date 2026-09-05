/**
 * v13.823.106 — acciones de ficha de lead:
 * si guardar o eliminar falla no se duplica el aviso de error
 * (useActualizarLead y useEliminarLead ya notifican en onError).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLeadDetalleAcciones } from "@/features/crm/hooks/useLeadDetalleAcciones";

const actualizarMutateAsync = vi.fn(async (_input: unknown) => ({}));
const eliminarMutateAsync = vi.fn(async (_id: string) => ({}));
const navigate = vi.fn();
const notifyError = vi.fn();
const successToast = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
}));
vi.mock("@/features/crm/hooks", () => ({
  useActualizarLead: () => ({ mutateAsync: actualizarMutateAsync, isPending: false }),
  useEliminarLead: () => ({ mutateAsync: eliminarMutateAsync, isPending: false }),
  useTomarLead: () => ({ mutate: vi.fn(), isPending: false }),
  useCalificarProspecto: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
}));
vi.mock("@/features/crm/lib/crmToast", () => ({
  crmToast: { success: (...args: unknown[]) => successToast(...args) },
}));

describe("useLeadDetalleAcciones", () => {
  beforeEach(() => {
    actualizarMutateAsync.mockClear();
    eliminarMutateAsync.mockClear();
    navigate.mockClear();
    notifyError.mockClear();
    successToast.mockClear();
  });

  it("guardar con éxito muestra sólo el toast de éxito", async () => {
    const { result } = renderHook(() =>
      useLeadDetalleAcciones("l1", { id: "l1", empresa: "ACME" }, { notas: "ok" }),
    );
    await result.current.handleSave();
    expect(successToast).toHaveBeenCalledWith("Cambios guardados");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("si guardar falla no repite el aviso de error (el hook ya notifica)", async () => {
    actualizarMutateAsync.mockRejectedValueOnce(new Error("RLS denegado"));
    const { result } = renderHook(() =>
      useLeadDetalleAcciones("l1", { id: "l1", empresa: "ACME" }, { notas: "ok" }),
    );
    await result.current.handleSave();
    expect(notifyError).not.toHaveBeenCalled();
    expect(successToast).not.toHaveBeenCalled();
  });

  it("eliminar con éxito navega a la lista", async () => {
    const { result } = renderHook(() =>
      useLeadDetalleAcciones("l1", { id: "l1", empresa: "ACME" }, {}),
    );
    await result.current.handleDelete();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("si eliminar falla no repite el aviso ni navega", async () => {
    eliminarMutateAsync.mockRejectedValueOnce(new Error("tiene cotizaciones"));
    const { result } = renderHook(() =>
      useLeadDetalleAcciones("l1", { id: "l1", empresa: "ACME" }, {}),
    );
    await result.current.handleDelete();
    expect(notifyError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
