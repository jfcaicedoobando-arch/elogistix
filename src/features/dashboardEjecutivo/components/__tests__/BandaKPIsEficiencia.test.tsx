/**
 * Fase 4 UI/UX — BandaKPIsEficiencia: render y placeholders.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BandaKPIsEficiencia } from "../BandaKPIsEficiencia";
import { calcularKPIsEjecutivos } from "../../services/alertas";
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
    expect(screen.getByText(/Runway · saldo bancario/)).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Bancos sin saldo")).toBeInTheDocument();
  });

  it("formatea días y meses cuando hay valores", () => {
    render(
      <BandaKPIsEficiencia
        kpis={{ ...base, saldo_bancos_mxn: 1000, dso_dias: 27.6, dpo_dias: 42, runway_meses: 3.5 }}
      />,
    );
    expect(screen.getByText("28 días")).toBeInTheDocument();
    expect(screen.getByText("42 días")).toBeInTheDocument();
    expect(screen.getByText("3.5 meses")).toBeInTheDocument();
  });

  it.each([
    [0, "Saldo bancario en cero", "Saldo bancario negativo"],
    [-1000, "Saldo bancario negativo", "Saldo bancario en cero"],
  ])("distingue el estado bancario con saldo %s", (saldo, mensaje, incorrecto) => {
    render(<BandaKPIsEficiencia kpis={{ ...base, saldo_bancos_mxn: saldo, runway_meses: 0 }} />);
    expect(screen.getByText(saldo < 0 ? "Bancos en negativo" : "Bancos sin saldo")).toBeInTheDocument();
    expect(screen.getByText(mensaje)).toBeInTheDocument();
    expect(screen.queryByText(incorrecto)).not.toBeInTheDocument();
  });
});

// Calculador real + tarjeta real: beneficio contable no elimina un banco negativo.
function snapshot(saldo: number, resultado: number, parcial: "ninguna" | "bancos" | "eerr") {
  return {
    eerrPeriodo: {
      totalIngresos: { total: 1000 }, totalCostos: { total: 1000 - resultado },
      utilidad: { total: resultado }, ingresos: [], costos: [],
      valuacion: { completa: parcial !== "eerr" },
    },
    tesoreria: {
      saldo_bancos_mxn: saldo, saldo_bancos_incompleto: parcial === "bancos",
      flujo: { por_cobrar_total_mxn: 500, por_pagar_total_mxn: 300 },
    },
    vencimientos: {
      cobranzaMayor30: { total_mxn: 0, count: 0, excluido_por_moneda: {} },
      cxpProximos7: { total_mxn: 0, excluido_por_moneda: {} },
    },
    presupuesto: { total_presupuesto_mxn: 0, total_real_mxn: 0 },
  } as unknown as Parameters<typeof calcularKPIsEjecutivos>[0];
}

const casos = [-100, 0, 100].flatMap(saldo =>
  [-100, 0, 100].flatMap(resultado =>
    (["ninguna", "bancos", "eerr"] as const).map(parcial => ({ saldo, resultado, parcial })),
  ),
);

describe("EX07 · señal de bancos y resultado mensual", () => {
  it.each(casos)("bancos $saldo, resultado $resultado, valuación $parcial", ({ saldo, resultado, parcial }) => {
    const kpis = calcularKPIsEjecutivos(snapshot(saldo, resultado, parcial), 0);
    // La presentación no redefine ningún cociente financiero.
    expect(kpis.runway_meses).toBe(parcial !== "ninguna" || resultado >= 0 ? null : saldo <= 0 ? 0 : saldo / -resultado);
    expect(kpis.dso_dias).toBe(parcial === "eerr" ? null : 15);
    expect(kpis.dpo_dias).toBe(parcial === "eerr" ? null : (300 / (1000 - resultado)) * 30);
    render(<BandaKPIsEficiencia kpis={kpis} />);
    const card = within(screen.getByText(/Runway/).closest(".rounded-lg")!);
    if (parcial !== "ninguna") {
      expect(card.getByText("No disponible")).toBeInTheDocument();
      expect(card.getByText("Valuación incompleta")).toHaveClass("text-muted-foreground");
      expect(card.queryByText("Sin burn")).not.toBeInTheDocument();
      expect(card.queryByText(/Bancos en negativo|Bancos sin saldo/)).not.toBeInTheDocument();
    } else if (saldo <= 0) {
      expect(card.getByText(saldo < 0 ? "Bancos en negativo" : "Bancos sin saldo")).toBeInTheDocument();
      expect(card.getByText(saldo < 0 ? "Saldo bancario negativo" : "Saldo bancario en cero")).toHaveClass("text-destructive");
      expect(card.queryByText("Sin burn")).not.toBeInTheDocument();
      expect(card.queryByText("Caja agotada")).not.toBeInTheDocument();
    } else if (resultado >= 0) {
      expect(card.getByText("Sin burn")).toBeInTheDocument();
    } else {
      expect(card.getByText("1.0 meses")).toBeInTheDocument();
    }
  });
});
