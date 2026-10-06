import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { startOfMonth, endOfMonth } from "date-fns";
import ReportesFiltros from "../ReportesFiltros";

afterEach(() => vi.useRealTimers());

const callbacks = () => ({ onFechaDesdeChange: vi.fn(), onFechaHastaChange: vi.fn(), onModoChange: vi.fn(), onApplyFilters: vi.fn() });

describe("ReportesFiltros", () => {
  it("cuenta un rango personalizado aunque el modo sea Todos y permite restablecerlo", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 26));
    const handlers = callbacks();
    render(<ReportesFiltros fechaDesde={new Date(2026, 8, 5)} fechaHasta={new Date(2026, 8, 10)} modo="all" {...handlers} />);
    expect(screen.getByRole("button", { name: /Filtros de fecha y modo 1/ })).toBeInTheDocument();
    expect(screen.getByText(/05 sep 2026 → 10 sep 2026 · Todos los modos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Filtros de fecha y modo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(handlers.onApplyFilters).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(handlers.onApplyFilters).toHaveBeenCalledWith({ fechaDesde: startOfMonth(new Date()), fechaHasta: endOfMonth(new Date()), modo: "all" });
  });

  it("no cuenta el mes actual como filtro personalizado", () => {
    const hoy = new Date();
    render(<ReportesFiltros fechaDesde={startOfMonth(hoy)} fechaHasta={endOfMonth(hoy)} modo="all" {...callbacks()} />);
    expect(screen.getByRole("button", { name: "Filtros de fecha y modo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtros de fecha y modo" }));
    expect(screen.getByRole("button", { name: "Limpiar" })).toBeDisabled();
  });
});
