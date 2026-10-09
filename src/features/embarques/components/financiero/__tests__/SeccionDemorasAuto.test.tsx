/**
 * P2-4 — "Eliminar auto" sólo debe ofrecerse cuando existen conceptos
 * `demoras_auto` persistidos (antes dependía de estado local que se perdía
 * al recargar). No se ejecuta ninguna eliminación real: los hooks se simulan.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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


describe("audit147 · resumen sin suma nominal", () => {
  it("muestra USD y MXN separados y limpia el resumen si otro recálculo falla", async () => {
    existentes.data = 0;
    recalcular.mutateAsync.mockResolvedValueOnce({
      sin_eventos: false, dias_excedidos: 2, total_costo_usd: 0, total_venta_usd: 2,
      totales_costo_por_moneda: { USD: 1, MXN: 20 }, contenedores: [],
    });
    render(<SeccionDemorasAuto embarqueId="e-1" canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /Recalcular/ }));
    expect(await screen.findByText("USD 1.00")).toBeInTheDocument();
    expect(screen.getByText("MXN 20.00")).toBeInTheDocument();
    expect(screen.queryByText(/21.00/)).toBeNull();
    recalcular.mutateAsync.mockRejectedValueOnce(new Error("LC_DEMORAS_MONEDAS_MIXTAS"));
    fireEvent.click(screen.getByRole("button", { name: /Recalcular/ }));
    await screen.findByText(/No hay demoras automáticas aplicadas/);
    expect(screen.queryByText("USD 1.00")).toBeNull();
  });
});
