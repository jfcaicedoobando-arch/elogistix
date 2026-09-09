/**
 * VIS-249-01 — cerrar el Sheet de notas con texto modificado pide confirmación
 * en lugar de perder el borrador en silencio; sin cambios cierra directo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mutateAsync = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useActualizarActividadNotas: () => ({ mutateAsync, isPending: false }),
}));

import ActividadNotasSheet from "@/features/crm/components/actividades/ActividadNotasSheet";

type Actividad = Parameters<typeof ActividadNotasSheet>[0]["actividad"];
const actividad = { id: "a1", asunto: "Llamada", resultado: "original" } as NonNullable<Actividad>;

describe("ActividadNotasSheet · descartar cambios", () => {
  beforeEach(() => mutateAsync.mockReset());

  it("pide confirmación al cancelar con texto modificado", () => {
    const onOpenChange = vi.fn();
    render(<ActividadNotasSheet actividad={actividad} open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText("Resultado / notas"), {
      target: { value: "borrador nuevo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("¿Descartar las notas?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cierra sin preguntar cuando no hubo cambios", () => {
    const onOpenChange = vi.fn();
    render(<ActividadNotasSheet actividad={actividad} open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
