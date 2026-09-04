/**
 * El feedback de éxito/error lo emiten los hooks de mutación; el componente no
 * debe duplicar toasts al crear ni al activar/desactivar un motivo. El campo
 * "nuevo motivo" sólo se limpia cuando la creación fue exitosa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const notifySuccess = vi.fn();
const notifyError = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: (...a: unknown[]) => notifySuccess(...a),
  notifyError: (...a: unknown[]) => notifyError(...a),
}));

const crearMutate = vi.fn();
const actualizarMutate = vi.fn();
vi.mock("@/features/crm/hooks", () => ({
  useMotivosPerdida: () => ({ data: [{ id: "m1", nombre: "Precio", activa: true }] }),
  useCrearMotivoPerdida: () => ({ mutate: crearMutate, isPending: false }),
  useActualizarMotivoPerdida: () => ({ mutate: actualizarMutate, isPending: false }),
}));

import MotivosPerdidaEditor from "@/features/crm/components/MotivosPerdidaEditor";

describe("MotivosPerdidaEditor", () => {
  beforeEach(() => {
    notifySuccess.mockClear();
    notifyError.mockClear();
    crearMutate.mockReset();
    actualizarMutate.mockReset();
  });

  it("no emite toasts propios al crear y limpia el campo sólo tras éxito", () => {
    crearMutate.mockImplementation((_n: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    render(<MotivosPerdidaEditor />);
    const input = screen.getByLabelText("Nuevo motivo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Tiempo de tránsito" } });
    fireEvent.click(screen.getByRole("button", { name: /Agregar/i }));

    expect(crearMutate).toHaveBeenCalledTimes(1);
    expect(crearMutate.mock.calls[0][0]).toBe("Tiempo de tránsito");
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
    expect(input.value).toBe("");
  });

  it("conserva el texto si la creación falla y no duplica el error", () => {
    crearMutate.mockImplementation(() => { /* el hook emite el error */ });
    render(<MotivosPerdidaEditor />);
    const input = screen.getByLabelText("Nuevo motivo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Competencia" } });
    fireEvent.click(screen.getByRole("button", { name: /Agregar/i }));

    expect(notifyError).not.toHaveBeenCalled();
    expect(input.value).toBe("Competencia");
  });

  it("al desactivar un motivo delega el feedback al hook", () => {
    render(<MotivosPerdidaEditor />);
    fireEvent.click(screen.getByLabelText("Desactivar motivo Precio"));

    expect(actualizarMutate).toHaveBeenCalledWith({ id: "m1", patch: { activa: false } });
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });
});
