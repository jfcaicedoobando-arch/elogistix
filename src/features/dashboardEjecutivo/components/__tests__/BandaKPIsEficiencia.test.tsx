/**
 * Fase 4 UI/UX — BandaKPIsEficiencia: render y placeholders.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BandaKPIsEficiencia } from "../BandaKPIsEficiencia";
import type { KPIsEjecutivos } from "@/features/dashboardEjecutivo/services";

const base: KPIsEjecutivos = {
  ingresos_mxn: 0, ingresos_delta_pct: null,
  utilidad_mxn: 0, utilidad_delta_pct: null,
  margen_pct: 0, margen_delta_puntos: null,
  saldo_bancos_mxn: 0,
  cartera_vencida_mxn: 0, cartera_vencida_count: 0,
  cxp_7dias_mxn: 0,
  cumplimiento_presupuesto_pct: 0, categorias_en_exceso: 0,
  dso_dias: null, dpo_dias: null, runway_meses: null,
};

describe("BandaKPIsEficiencia", () => {
  it("renderiza los 3 KPIs con placeholders cuando no hay datos", () => {
    render(<BandaKPIsEficiencia kpis={base} />);
    expect(screen.getByText(/DSO — Días de cobro/)).toBeInTheDocument();
    expect(screen.getByText(/DPO — Días de pago/)).toBeInTheDocument();
    expect(screen.getByText(/Runway financiero/)).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Sin burn/)).toBeInTheDocument();
  });

  it("formatea días y meses cuando hay valores", () => {
    render(
      <BandaKPIsEficiencia
        kpis={{ ...base, dso_dias: 27.6, dpo_dias: 42, runway_meses: 3.5 }}
      />,
    );
    expect(screen.getByText("28 días")).toBeInTheDocument();
    expect(screen.getByText("42 días")).toBeInTheDocument();
    expect(screen.getByText("3.5 meses")).toBeInTheDocument();
  });
});
