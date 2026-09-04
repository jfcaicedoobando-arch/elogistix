/**
 * Sin oportunidades abiertas los porcentajes se leen como guion y leyenda,
 * no como 0% (que significaría mal desempeño).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HigieneKpis from "../HigieneKpis";
import type { HigieneResumen } from "@/features/crm/services/higiene";

const base: HigieneResumen = {
  abiertas: 0,
  registros_completos: 0,
  higiene_pct: 0,
  seguimiento_oportuno_pct: 0,
  vencidas: 0,
  sin_actividad_programada: 0,
  pipeline_bruto: 0,
  pipeline_ponderado: 0,
  tc_estimado: false,
} as unknown as HigieneResumen;

describe("HigieneKpis", () => {
  it("muestra guion y leyenda cuando no hay oportunidades abiertas", () => {
    render(<HigieneKpis resumen={base} cobertura={null} presupuestoMes={{ monto: 0, moneda: "MXN" }} />);
    expect(screen.getAllByText("—").length).toBe(2);
    expect(screen.getAllByText("Requiere oportunidades abiertas para medirse").length).toBe(2);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("muestra cobertura en MXN y etiqueta la meta con su moneda", () => {
    render(
      <HigieneKpis
        resumen={{ ...base, abiertas: 4, pipeline_ponderado: 250000 }}
        cobertura={0.5}
        presupuestoMes={{ monto: 500000, moneda: "MXN" }}
      />,
    );
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText(/Meta del mes/)).toBeTruthy();
  });

  it("muestra 'Sin conversión' y la moneda real cuando el presupuesto es extranjero", () => {
    render(
      <HigieneKpis
        resumen={{ ...base, abiertas: 4, pipeline_ponderado: 250000 }}
        cobertura={null}
        presupuestoMes={{ monto: 30000, moneda: "USD" }}
      />,
    );
    expect(screen.getByText("Sin conversión")).toBeTruthy();
    expect(screen.getByText(/USD/)).toBeTruthy();
    expect(screen.queryByText("Sin presupuesto")).toBeNull();
  });

  it("muestra porcentajes cuando hay muestra", () => {
    render(
      <HigieneKpis
        resumen={{ ...base, abiertas: 3, registros_completos: 2, higiene_pct: 0.6667, seguimiento_oportuno_pct: 0.3333, vencidas: 1, sin_actividad_programada: 1 }}
        cobertura={null}
        presupuestoMes={{ monto: 0, moneda: "MXN" }}
      />,
    );
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("33%")).toBeTruthy();
    expect(screen.getByText("2 de 3 oportunidades completas")).toBeTruthy();
  });
});
