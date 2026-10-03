import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FuenteEerrToggle } from "../FuenteEerrToggle";

vi.mock("@/features/profit/hooks/useFuenteEerr", () => ({ useFuenteEerr: () => ({ fuente: "embarques", setFuente: vi.fn() }) }));

describe("Ayuda EERR - criterio operativo vigente", () => {
  it("describe ventas facturadas netas de NC por ETA y costos de conceptos", async () => {
    render(<FuenteEerrToggle />);
    fireEvent.click(screen.getByRole("button", { name: "¿Qué significa cada fuente?" }));
    const ayuda = await screen.findByText(/Suma ventas facturadas de embarques/);
    expect(ayuda).toHaveTextContent("ETA");
    expect(ayuda).toHaveTextContent("menos notas de crédito aplicadas, contra sus conceptos de costo");
    expect(ayuda).toHaveTextContent("Los conceptos de venta aún no facturados no son ingreso");
    expect(ayuda).not.toHaveTextContent("sin importar cuándo se factura");
    expect(ayuda).not.toHaveTextContent("no se restan aquí");
  });
});
