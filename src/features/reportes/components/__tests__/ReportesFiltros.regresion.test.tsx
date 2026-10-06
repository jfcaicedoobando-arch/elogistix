import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { format } from "date-fns";
import ReportesFiltros from "../ReportesFiltros";
import { useReportesFilters } from "../../hooks/useReportesFilters";

vi.mock("@/components/ui/calendar", () => ({ Calendar: ({ onSelect }: { onSelect: (d: Date) => void }) => <>
  <button onClick={() => onSelect(new Date(2026, 10, 10))}>Elegir 10 noviembre</button>
  <button onClick={() => onSelect(new Date(2026, 8, 5))}>Elegir 5 septiembre</button>
</> }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: vi.fn() }));
function Report() {
  const c = useReportesFilters();
  const navigate = useNavigate();
  return <>
    <output data-testid="applied">{format(c.fechaDesde, "yyyy-MM-dd")}|{format(c.fechaHasta, "yyyy-MM-dd")}|{c.modo}|{c.sortField}|{c.sortDir}</output>
    <ReportesFiltros fechaDesde={c.fechaDesde} fechaHasta={c.fechaHasta} modo={c.modo} onFechaDesdeChange={c.setFechaDesde} onFechaHastaChange={c.setFechaHasta} onModoChange={c.setModo} onApplyFilters={c.applyFilters} />
    <button onClick={() => c.setModo("Marítimo")}>Modo escritorio</button>
    <button onClick={() => c.handleSort("costo_usd")}>Ordenar costo</button>
    <button onClick={() => navigate("/clientes/1")}>Abrir cliente</button>
  </>;
}
function Nav() {
  const nav = useNavigate();
  const location = useLocation();
  return <><output data-testid="url">{location.pathname}{location.search}</output><button onClick={() => nav(-1)}>Atrás</button><button onClick={() => nav(1)}>Adelante</button></>;
}
const initial = "/reportes?desde=2026-10-15&hasta=2026-10-20&modo=Terrestre&sort=profit_usd&dir=asc";
const mount = () => render(<MemoryRouter initialEntries={[initial]}><Nav /><Routes><Route path="/reportes" element={<Report />} /><Route path="/clientes/1" element={<p>Cliente acumulado MXN</p>} /></Routes></MemoryRouter>);
const open = () => fireEvent.click(screen.getByRole("button", { name: /Filtros de fecha y modo/ }));
const chooseFuture = () => {
  const sheet = screen.getByRole("dialog", { name: "Filtros de reporte" });
  fireEvent.click(within(sheet).getByRole("button", { name: "15 oct 2026" }));
  fireEvent.click(screen.getByRole("button", { name: "Elegir 10 noviembre" }));
  // Escape closes only the calendar, then the sheet can be cancelled/applied.
  fireEvent.keyDown(document, { key: "Escape" });
};
describe("136 draft filters and 137 navigation", () => {
  it.each(["Cerrar", "Escape"])("discards crossed dates via %s without changing applied filters or URL", (dismiss) => {
    mount(); open(); chooseFuture();
    expect(screen.getByTestId("applied")).toHaveTextContent("2026-10-15|2026-10-20|Terrestre");
    expect(screen.getByTestId("url").textContent).toBe(initial);
    if (dismiss === "Cerrar") fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    else fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Filtros de reporte" })).not.toBeInTheDocument();
    expect(screen.getByTestId("applied")).toHaveTextContent("2026-10-15|2026-10-20|Terrestre");
    open();
    expect(within(screen.getByRole("dialog", { name: "Filtros de reporte" })).getByRole("button", { name: "15 oct 2026" })).toBeInTheDocument();
  });
  it("commits the adjusted date pair together only on Aplicar", () => {
    mount(); open(); chooseFuture();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(screen.getByTestId("applied")).toHaveTextContent("2026-11-10|2026-11-30|Terrestre");
    expect(screen.getByTestId("url")).toHaveTextContent("desde=2026-11-10&hasta=2026-11-30");
  });
  it("discards the inverse crossing and keeps a previously applied selection on repeated reopening", () => {
    mount(); open();
    const sheet = screen.getByRole("dialog", { name: "Filtros de reporte" });
    fireEvent.click(within(sheet).getByRole("button", { name: "20 oct 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Elegir 5 septiembre" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByTestId("applied")).toHaveTextContent("2026-10-15|2026-10-20|Terrestre");
    open(); chooseFuture();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    open(); fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByTestId("applied")).toHaveTextContent("2026-11-10|2026-11-30|Terrestre");
  });
  it("clearing then closing leaves the custom range and mode intact", () => {
    mount(); open(); fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByTestId("applied")).toHaveTextContent("2026-10-15|2026-10-20|Terrestre");
    expect(screen.getByTestId("url").textContent).toBe(initial);
  });
  it("retains range, mode and order through client navigation and back/forward", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Modo escritorio" }));
    fireEvent.click(screen.getByRole("button", { name: "Ordenar costo" }));
    const appliedUrl = screen.getByTestId("url").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Abrir cliente" }));
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByTestId("applied")).toHaveTextContent("2026-10-15|2026-10-20|Marítimo|costo_usd|desc");
    expect(screen.getByTestId("url").textContent).toBe(appliedUrl);
    fireEvent.click(screen.getByRole("button", { name: "Adelante" }));
    expect(screen.getByText("Cliente acumulado MXN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByTestId("applied")).toHaveTextContent("2026-10-15|2026-10-20|Marítimo|costo_usd|desc");
  });
});
