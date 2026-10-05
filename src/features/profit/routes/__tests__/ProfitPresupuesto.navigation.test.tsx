import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { usePeriodoMesUrl } from "@/features/profit/hooks/usePeriodoMesUrl";
import { BudgetOverrunSheet } from "@/features/profit/components/BudgetOverrunSheet";
import ProfitPresupuesto from "../ProfitPresupuesto";

vi.mock("@/features/presupuesto/components/TabCaptura", () => ({
  TabCaptura: () => <p>Cuadrícula editable</p>,
}));
vi.mock("@/features/presupuesto/components/TabCategorias", () => ({
  TabCategorias: () => <p>Configuración de categorías</p>,
}));
vi.mock("@/features/presupuesto/components/TabVsReal", () => ({
  TabVsReal: () => {
    const periodo = usePeriodoMesUrl("periodo_vs_real");
    return <>
      <p>Comparativo {periodo.mesActual.key}</p>
      <button onClick={() => periodo.setMesKey("2026-09")}>Consultar septiembre</button>
    </>;
  },
}));

function LocationMarker() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="location">{location.pathname}{location.search}</output>
    <button onClick={() => navigate("/profit/presupuesto?tab=config")}>URL externa</button>
  </>;
}

function mostrar(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <LocationMarker />
      <Routes>
        <Route path="/profit/presupuesto" element={<ProfitPresupuesto />} />
        <Route path="/profit/dashboard" element={
          <BudgetOverrunSheet open onOpenChange={vi.fn()} filas={[]} periodo="2026-09" />
        } />
      </Routes>
    </MemoryRouter>,
  );
}

function elegirTab(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
}

describe("80: consultas de presupuesto persistentes", () => {
  beforeEach(() => vi.setSystemTime(new Date("2026-10-04T12:00:00Z")));

  it("abre el comparativo de septiembre desde un enlace anterior con sólo periodo", () => {
    mostrar("/profit/presupuesto?periodo_vs_real=2026-09");
    expect(screen.getByText("Comparativo 2026-09")).toBeVisible();
    expect(screen.queryByText("Cuadrícula editable")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Vs Real" })).toHaveAttribute("aria-selected", "true");
  });

  it("conserva pestaña, periodo y otros parámetros al recargar la consulta", () => {
    const first = mostrar("/profit/presupuesto?origen=dashboard");
    elegirTab("Vs Real");
    fireEvent.click(screen.getByRole("button", { name: "Consultar septiembre" }));
    const url = screen.getByTestId("location").textContent!;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("tab")).toBe("vs-real");
    expect(params.get("periodo_vs_real")).toBe("2026-09");
    expect(params.get("origen")).toBe("dashboard");
    first.unmount();

    mostrar(url);
    expect(screen.getByText("Comparativo 2026-09")).toBeVisible();
    expect(screen.queryByText("Cuadrícula editable")).not.toBeInTheDocument();
  });

  it("persiste Captura explícita aunque se conserve el periodo de la consulta", () => {
    const first = mostrar("/profit/presupuesto?periodo_vs_real=2026-09");
    elegirTab("Captura");
    const url = screen.getByTestId("location").textContent!;
    expect(url).toContain("tab=captura");
    expect(url).toContain("periodo_vs_real=2026-09");
    first.unmount();

    mostrar(url);
    expect(screen.getByText("Cuadrícula editable")).toBeVisible();
    expect(screen.queryByText("Comparativo 2026-09")).not.toBeInTheDocument();
  });

  it("sincroniza la pestaña con una navegación externa de URL", () => {
    mostrar("/profit/presupuesto?tab=vs-real&periodo_vs_real=2026-09");
    fireEvent.click(screen.getByRole("button", { name: "URL externa" }));
    expect(screen.getByText("Configuración de categorías")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Configuración" })).toHaveAttribute("aria-selected", "true");
  });

  it("Ver presupuesto completo abre Vs Real del mismo periodo del panel", () => {
    mostrar("/profit/dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Ver presupuesto completo" }));
    expect(screen.getByText("Comparativo 2026-09")).toBeVisible();
    expect(screen.getByTestId("location")).toHaveTextContent("tab=vs-real");
    expect(screen.queryByText("Cuadrícula editable")).not.toBeInTheDocument();
  });
});
