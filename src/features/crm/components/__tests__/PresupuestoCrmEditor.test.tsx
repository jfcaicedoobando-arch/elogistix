/**
 * El borrador del presupuesto está asociado al año: si el usuario captura un
 * monto y cambia de año antes de guardar, ese valor no debe persistirse en el
 * año nuevo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mutateAsync = vi.fn();
vi.mock("@/features/crm/hooks/useHigienePipeline", () => ({
  usePresupuestoCrm: () => ({ data: [], isLoading: false }),
  useGuardarPresupuestoMes: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organizationId: "org-1" }),
}));

import PresupuestoCrmEditor from "@/features/crm/components/PresupuestoCrmEditor";

describe("PresupuestoCrmEditor", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue(undefined);
  });

  it("no arrastra el borrador de un año al siguiente", () => {
    render(<PresupuestoCrmEditor />);
    const anio = screen.getByLabelText("Año") as HTMLInputElement;
    const anioInicial = Number(anio.value);

    fireEvent.change(screen.getByLabelText("Presupuesto de Enero"), { target: { value: "5000" } });
    fireEvent.change(anio, { target: { value: String(anioInicial + 1) } });

    // El campo vuelve vacío y Guardar queda deshabilitado en el año nuevo.
    expect((screen.getByLabelText("Presupuesto de Enero") as HTMLInputElement).value).toBe("");
    const botones = screen.getAllByRole("button", { name: "Guardar" });
    expect(botones[0]).toBeDisabled();

    // Al volver al año original el borrador sigue disponible.
    fireEvent.change(anio, { target: { value: String(anioInicial) } });
    expect((screen.getByLabelText("Presupuesto de Enero") as HTMLInputElement).value).toBe("5000");
  });

  it("guarda el monto con el año visible", async () => {
    render(<PresupuestoCrmEditor />);
    const anio = screen.getByLabelText("Año") as HTMLInputElement;
    const anioInicial = Number(anio.value);

    fireEvent.change(screen.getByLabelText("Presupuesto de Febrero"), { target: { value: "1200" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" })[1]);

    expect(mutateAsync).toHaveBeenCalledWith({
      organizationId: "org-1",
      anio: anioInicial,
      mes: 2,
      monto: 1200,
      moneda: "MXN",
    });
  });
});
