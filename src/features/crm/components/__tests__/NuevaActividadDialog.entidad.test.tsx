/**
 * v13.823.50 — regresión A → cerrar → B: el diálogo "Próximo paso" reusaba el
 * estado del primer render, así que mostraba el nombre de la oportunidad B
 * mientras conservaba el id de A.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

const props = (id: string, nombre: string) => ({
  open: true,
  onOpenChange: vi.fn(),
  defaultEntidad: { tipo: "oportunidad" as const, id, label: nombre },
});

describe("NuevaActividadDialog", () => {
  it("usa la entidad vigente tras cerrar A y abrir B", async () => {
    mutateAsync.mockClear();
    const { rerender } = render(<NuevaActividadDialog {...props("op-A", "Op A")} />);
    expect(screen.getByText("Op A")).toBeTruthy();

    rerender(<NuevaActividadDialog {...props("op-A", "Op A")} open={false} />);
    rerender(<NuevaActividadDialog {...props("op-B", "Op B")} />);
    expect(screen.getByText("Op B")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Asunto/i), { target: { value: "Llamar" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ entidad_id: "op-B", entidad_tipo: "oportunidad" }),
      ),
    );
  });

  it("no arrastra el borrador de A hacia B (v13.823.51)", async () => {
    mutateAsync.mockClear();
    const { rerender } = render(<NuevaActividadDialog {...props("op-A", "Op A")} />);
    fireEvent.change(screen.getByLabelText(/Asunto/i), { target: { value: "Borrador de A" } });

    rerender(<NuevaActividadDialog {...props("op-A", "Op A")} open={false} />);
    rerender(<NuevaActividadDialog {...props("op-B", "Op B")} />);

    expect((screen.getByLabelText(/Asunto/i) as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText(/Asunto/i), { target: { value: "Solo de B" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ entidad_id: "op-B", asunto: "Solo de B" }),
      ),
    );
  });
});
