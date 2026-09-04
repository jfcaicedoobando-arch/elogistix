/**
 * Auditoría CRM v13.823.75 · hallazgo 2 — "Crear" quedaba habilitado con
 * Asunto u Oportunidad vacíos y el clic era un no-op silencioso.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NuevaActividadDialog from "@/features/crm/components/NuevaActividadDialog";

const mutateAsync = vi.fn(async () => ({ id: "act-1" }));
vi.mock("@/features/crm/hooks", () => ({
  ACTIVIDAD_TIPOS: ["tarea"] as const,
  useCrearActividad: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/features/crm/components/comboboxes/EntidadComboboxCrm", () => ({
  LeadComboboxCrm: () => <div />,
  OportunidadComboboxCrm: () => <div />,
}));

describe("NuevaActividadDialog — validación visible", () => {
  it("sin oportunidad ni asunto, Crear está deshabilitado y no muta", () => {
    mutateAsync.mockClear();
    render(<NuevaActividadDialog open onOpenChange={vi.fn()} />);
    const crear = screen.getByRole("button", { name: "Crear" }) as HTMLButtonElement;
    expect(crear.disabled).toBe(true);
    fireEvent.click(crear);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("con oportunidad pero sin asunto sigue bloqueado", () => {
    render(
      <NuevaActividadDialog
        open
        onOpenChange={vi.fn()}
        defaultEntidad={{ tipo: "oportunidad", id: "op-1", label: "Op 1" }}
      />,
    );
    expect((screen.getByRole("button", { name: "Crear" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("con oportunidad y asunto se habilita y crea", async () => {
    mutateAsync.mockClear();
    render(
      <NuevaActividadDialog
        open
        onOpenChange={vi.fn()}
        defaultEntidad={{ tipo: "oportunidad", id: "op-1", label: "Op 1" }}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Asunto/i), { target: { value: "Llamar" } });
    const crear = screen.getByRole("button", { name: "Crear" }) as HTMLButtonElement;
    expect(crear.disabled).toBe(false);
    fireEvent.click(crear);
    expect(mutateAsync).toHaveBeenCalled();
  });
});
