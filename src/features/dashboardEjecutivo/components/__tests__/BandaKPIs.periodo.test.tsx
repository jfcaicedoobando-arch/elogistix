import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { BandaKPIs } from "../BandaKPIs";
import type { KPIsEjecutivos } from "../../services";

vi.mock("../KpiDrilldownSheet", () => ({ KpiDrilldownSheet: () => null }));
vi.mock("@/features/profit/components/BudgetOverrunSheet", () => ({ BudgetOverrunSheet: () => null }));
const kpis: KPIsEjecutivos = { ingresos_mxn: 0, ingresos_delta_pct: null, utilidad_mxn: -6000, utilidad_delta_pct: null,
  margen_pct: 0, margen_delta_puntos: null, saldo_bancos_mxn: 0, cartera_vencida_mxn: 0, cartera_vencida_count: 0,
  cxp_7dias_mxn: 0, cumplimiento_presupuesto_pct: 0, categorias_en_exceso: 0, dso_dias: null, dpo_dias: null, runway_meses: null };
function Ubicacion() {
  const l = useLocation(); const nav = useNavigate();
  return <><output aria-label="ubicacion">{l.pathname}{l.search}</output><button onClick={() => nav(-1)}>Atrás</button><button onClick={() => nav(1)}>Adelante</button></>;
}
describe("Auditoría90 · drilldown del periodo y fuente", () => {
  it.each(["Ingresos del periodo", "Utilidad operativa"])("%s conserva septiembre y fuente en el enlace y la historia", (label) => {
    render(<MemoryRouter initialEntries={["/profit/dashboard?mes=2026-09"]}>
      <BandaKPIs kpis={kpis} periodo="2026-09" fuente="facturas" /><Ubicacion />
    </MemoryRouter>);
    fireEvent.click(screen.getByText(label));
    expect(screen.getByLabelText("ubicacion")).toHaveTextContent("/profit/estado-resultados?mes=2026-09&fuente=facturas");
    fireEvent.click(screen.getByText("Atrás"));
    expect(screen.getByLabelText("ubicacion")).toHaveTextContent("/profit/dashboard?mes=2026-09");
    fireEvent.click(screen.getByText("Adelante"));
    expect(screen.getByLabelText("ubicacion")).toHaveTextContent("mes=2026-09&fuente=facturas");
  });
});
