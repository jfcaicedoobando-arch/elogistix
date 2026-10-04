import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TablaFlujoSemanal from "../TablaFlujoSemanal";
import type { SemanaFlujo } from "@/features/tesoreria/services";

const semana: SemanaFlujo = {
  semana_iso: "2026-W40", inicio: "2026-09-28", fin: "2026-10-04",
  entradas_mxn: 0, salidas_mxn: 1160, flujo_neto_mxn: -1160, saldo_proyectado_mxn: -1160,
  detalle_entradas: [], detalle_salidas: [],
};

describe("TablaFlujoSemanal - saldo disponible", () => {
  it("permite reconstruir la conversión del documento en el detalle semanal", () => {
    render(<TablaFlujoSemanal semanas={[{
      ...semana, salidas_mxn: 1900,
      detalle_salidas: [{
        id: "fp8", concepto: "FP8 · Agente", moneda: "USD", fecha_vencimiento: "2026-10-03",
        monto_original: 95, tipo_cambio_aplicado: 20, monto_mxn: 1900,
      }],
    }]} />);
    fireEvent.click(screen.getByRole("button", { name: /Expandir detalle de la semana/ }));
    expect(screen.getByText(/95\.00.*TC documento USD\/MXN 20\.0000/)).toBeInTheDocument();
    expect(screen.getAllByText(/1,900/)).toHaveLength(2);
  });
  it("conserva obligaciones y flujo neto sin representar el saldo bancario desconocido como negativo", () => {
    render(<TablaFlujoSemanal semanas={[semana]} saldoDisponible={false} />);
    expect(screen.getByText("No disponible")).toBeInTheDocument();
    expect(screen.getByText("No disponible")).not.toHaveClass("text-destructive");
    expect(screen.getAllByText(/1,160/)).toHaveLength(2);
  });

  it("muestra el saldo negativo cuando hay una base bancaria disponible", () => {
    render(<TablaFlujoSemanal semanas={[semana]} saldoDisponible />);
    expect(screen.queryByText("No disponible")).not.toBeInTheDocument();
    expect(screen.getAllByText(/1,160/)).toHaveLength(3);
  });
});
