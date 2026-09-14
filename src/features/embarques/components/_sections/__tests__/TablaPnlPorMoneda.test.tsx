import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TablaPorMoneda } from "../TablaPnlPorMoneda";
import type { FilaPnlContenedor } from "@/features/embarques/services/pnlPorContenedor";

const base: FilaPnlContenedor = {
  contenedorId: "c1",
  subexpediente: "EXP-01",
  numeroContenedor: "MSCU1234567",
  tipoContenedor: "40HC",
  ventaDirecta: 0,
  ventaProrrateada: 100,
  ventaTotal: 100,
  costoDirecto: 0,
  costoProrrateado: 60,
  costoTotal: 60,
  utilidad: 40,
  margenPct: 40,
};

describe("TablaPorMoneda", () => {
  it("identifica el presupuesto y el origen ya prorrateado", () => {
    const generales = {
      ...base,
      contenedorId: null,
      subexpediente: "Generales (sin asignar)",
      esGenerales: true,
    };
    const total = { ...base, contenedorId: null, subexpediente: "Total embarque", esTotal: true };
    render(<TablaPorMoneda moneda="USD" filas={[base, generales, total]} />);

    expect(screen.getByText("Presupuesto")).toBeTruthy();
    expect(screen.getByText("Origen del prorrateo")).toBeTruthy();
    expect(screen.getByText("Ya incluido en los contenedores · no se suma al total")).toBeTruthy();
    expect(screen.getByText("Total embarque")).toBeTruthy();
  });
});