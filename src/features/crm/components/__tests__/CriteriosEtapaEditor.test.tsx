/**
 * v13.823.102 — editor de criterios de salida:
 *  - el criterio se crea en la etapa elegida,
 *  - si la creación falla no se duplica el aviso de error (useCrearCriterioEtapa
 *    ya notifica en onError).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CriteriosEtapaEditor from "@/features/crm/components/CriteriosEtapaEditor";

const mutateAsync = vi.fn(async () => ({ id: "c1" }));
const notifyError = vi.fn();
const successToast = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useEtapasPipeline: () => ({
    data: [{ id: "e1", nombre: "Calificado", orden: 1, tipo: "abierta", probabilidad_default: 10 }],
  }),
}));
vi.mock("@/features/crm/hooks/useCriteriosEtapa", () => ({
  useCriteriosEtapa: () => ({ data: [], isLoading: false }),
  useCrearCriterioEtapa: () => ({ mutateAsync, isPending: false }),
  useActualizarCriterioEtapa: () => ({ mutate: vi.fn(), isPending: false }),
  useEliminarCriterioEtapa: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: vi.fn(),
}));
vi.mock("@/features/crm/lib/crmToast", () => ({
  crmToast: { success: (...args: unknown[]) => successToast(...args) },
}));

describe("CriteriosEtapaEditor", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    notifyError.mockClear();
    successToast.mockClear();
  });

  it("crea un criterio y muestra el éxito local", async () => {
    render(<CriteriosEtapaEditor />);

    fireEvent.change(screen.getByLabelText(/Nuevo criterio/i), {
      target: { value: "Cliente confirmó volumen" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Agregar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0]![0]).toMatchObject({
      etapa_id: "e1",
      nombre: "Cliente confirmó volumen",
      obligatorio: true,
    });
    expect(successToast).toHaveBeenCalledWith("Criterio agregado");
  });

  it("si la creación falla no repite el aviso de error (el hook ya notifica)", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("RLS denegado"));
    render(<CriteriosEtapaEditor />);

    fireEvent.change(screen.getByLabelText(/Nuevo criterio/i), {
      target: { value: "Cliente confirmó volumen" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Agregar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    // El único feedback de error visible lo emite useCrearCriterioEtapa.onError.
    expect(notifyError).not.toHaveBeenCalled();
  });
});
