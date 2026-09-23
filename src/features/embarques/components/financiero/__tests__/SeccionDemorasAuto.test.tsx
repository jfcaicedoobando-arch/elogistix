/**
 * P2-4 — "Eliminar auto" sólo debe ofrecerse cuando existen conceptos
 * `demoras_auto` persistidos (antes dependía de estado local que se perdía
 * al recargar). No se ejecuta ninguna eliminación real: los hooks se simulan.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const recalcular = { mutateAsync: vi.fn(), isPending: false };
const eliminar = { mutate: vi.fn(), isPending: false };
const existentes = { data: 0 as number | undefined };

vi.mock("@/features/embarques/hooks/useDemorasEmbarque", () => ({
  useRecalcularDemoras: () => recalcular,
  useEliminarDemorasAuto: () => eliminar,
  useDemorasAutoExistentes: () => existentes,
}));

import { SeccionDemorasAuto } from "../SeccionDemorasAuto";

describe("SeccionDemorasAuto", () => {
  beforeEach(() => {
    existentes.data = 0;
    vi.clearAllMocks();
  });

  it("sin demoras persistidas no ofrece eliminar y lo dice claramente", () => {
    render(<SeccionDemorasAuto embarqueId="e-1" canEdit />);
    expect(screen.queryByRole("button", { name: /Eliminar auto/i })).toBeNull();
    expect(screen.getByText(/No hay demoras automáticas aplicadas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recalcular/i })).toBeInTheDocument();
  });

  it("con demoras persistidas ofrece eliminar aunque no se haya recalculado en esta sesión", () => {
    existentes.data = 2;
    render(<SeccionDemorasAuto embarqueId="e-1" canEdit />);
    expect(screen.getByRole("button", { name: /Eliminar auto/i })).toBeInTheDocument();
    expect(screen.getByText(/concepto\(s\) de demoras automáticas/i)).toBeInTheDocument();
    expect(eliminar.mutate).not.toHaveBeenCalled();
  });

  it("sin permiso de edición no muestra acciones", () => {
    existentes.data = 3;
    render(<SeccionDemorasAuto embarqueId="e-1" canEdit={false} />);
    expect(screen.queryByRole("button", { name: /Eliminar auto/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Recalcular/i })).toBeNull();
  });
});
