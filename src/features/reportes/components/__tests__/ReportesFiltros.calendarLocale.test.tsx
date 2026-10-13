import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReportesFiltros from "../ReportesFiltros";

describe("Rentabilidad · calendario real en español", () => {
  it.each(["escritorio", "móvil"])("traduce ARIA y conserva el contrato de fechas en %s", async (vista) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 13, 12));
    const onFechaDesdeChange = vi.fn();
    const onApplyFilters = vi.fn();
    render(<ReportesFiltros fechaDesde={new Date(2026, 9, 13)} fechaHasta={new Date(2026, 9, 31)}
      modo="all" onFechaDesdeChange={onFechaDesdeChange} onFechaHastaChange={vi.fn()}
      onModoChange={vi.fn()} onApplyFilters={onApplyFilters} />);

    if (vista === "móvil") {
      fireEvent.click(screen.getByRole("button", { name: /Filtros de fecha y modo/ }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "Filtros de reporte" }))
        .getByRole("button", { name: "13 oct 2026" }));
    } else {
      fireEvent.click(screen.getByRole("button", { name: "13 oct 2026" }));
    }
    expect(await screen.findByRole("navigation", { name: "Barra de navegación" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ir al mes siguiente" }));
    expect(screen.getByRole("grid", { name: "noviembre 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ir al mes anterior" }));
    const seleccionado = screen.getByRole("button", { name: "Hoy, martes, 13 de octubre de 2026, seleccionado" });
    act(() => seleccionado.focus());
    fireEvent.keyDown(seleccionado, { key: "ArrowRight" });
    const siguiente = screen.getByRole("button", { name: "miércoles, 14 de octubre de 2026" });
    expect(siguiente).toHaveFocus();
    fireEvent.click(siguiente);

    if (vista === "móvil") {
      expect(onApplyFilters).not.toHaveBeenCalled();
      expect(onFechaDesdeChange).not.toHaveBeenCalled();
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(onApplyFilters).toHaveBeenCalledExactlyOnceWith({
        fechaDesde: new Date(2026, 9, 14), fechaHasta: new Date(2026, 9, 31), modo: "all",
      });
    } else {
      expect(onFechaDesdeChange).toHaveBeenCalledExactlyOnceWith(new Date(2026, 9, 14));
    }
  });
});
