import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { formatPercent } from "@/lib/formatters";
import { MODOS_COLUMNAS, buildEstadoResultados, type TotalER } from "../../domain/estadoResultados";
import { EstadoResultadosTable } from "../EstadoResultadosTable";
import { fmt } from "../EstadoResultadosTable.helpers";
import { mobileEerrFixture } from "./estadoResultadosMobile.fixtures";

afterEach(cleanup);

function mobile(container: HTMLElement) {
  return container.querySelector<HTMLElement>(".sm\\:hidden")!;
}

function amounts(container: HTMLElement, label: string) {
  // A heading's parent contains its entire card, without depending on the row implementation.
  return within(mobile(container)).getByText(label, { exact: true }).parentElement!;
}

function expectAmounts(card: HTMLElement, total: TotalER) {
  const rows = card.querySelectorAll("dl > div");
  expect(rows).toHaveLength(5);
  [...MODOS_COLUMNAS, "Total"].forEach((modo, i) => {
    expect(rows[i].querySelector("dt")?.textContent).toBe(modo);
    const amount = i === 4 ? total.total : total.porModo[MODOS_COLUMNAS[i]];
    expect(rows[i].querySelector("dd")?.textContent).toBe(fmt(amount));
  });
}

describe("Estado de resultados: mobile/desktop breakdown parity", () => {
  it("keeps each concept's four modes and total, including negative and zero amounts", () => {
    const data = mobileEerrFixture();
    const { container } = render(<EstadoResultadosTable data={data} />);
    for (const fila of [...data.ingresos, ...data.costos]) {
      expectAmounts(amounts(container, fila.concepto), fila);
    }
    expect(amounts(container, data.ingresos[0].concepto)).toHaveTextContent("MXN -456,789.25");
    expect(amounts(container, data.ingresos[0].concepto)).toHaveTextContent("—");
  });

  it.each(["totalIngresos", "totalCostos", "utilidad"] as const)("shows every mode in %s rather than only its total", (key) => {
    const data = mobileEerrFixture();
    const labels = { totalIngresos: "TOTAL INGRESOS", totalCostos: "TOTAL COSTOS", utilidad: "UTILIDAD BRUTA" };
    const { container } = render(<EstadoResultadosTable data={data} />);
    expectAmounts(amounts(container, labels[key]), data[key]);
  });

  it("shows each mode's margin with its own income denominator and the consolidated margin", () => {
    const data = mobileEerrFixture();
    const { container } = render(<EstadoResultadosTable data={data} />);
    const rows = amounts(container, "Margen %").querySelectorAll("dd");
    expect(rows).toHaveLength(5);
    MODOS_COLUMNAS.forEach((modo, i) => {
      expect(rows[i].textContent).toBe(data.totalIngresos.porModo[modo] === 0
        ? "No calculable" : formatPercent(data.margen.porModo[modo]));
    });
    expect(rows[4].textContent).toBe(formatPercent(data.margen.total));
  });

  it("keeps incomplete income/cost partials but blocks all five profit and margin values", () => {
    const data = mobileEerrFixture();
    data.valuacion = { completa: false, conceptos_sin_tc_count: 1, excluidos_sin_tc: [
      { embarque_id: "fixture-missing-fx", concepto: "Costo sin TC", nominal: 100, moneda: "USD", modo: "Aéreo", seccion: "costos" },
    ] };
    const { container, getByRole } = render(<EstadoResultadosTable data={data} />);
    expect(getByRole("status")).toHaveTextContent("Valuación incompleta");
    expectAmounts(amounts(container, "INGRESOS PARCIALES"), data.totalIngresos);
    expectAmounts(amounts(container, "COSTOS PARCIALES"), data.totalCostos);
    for (const label of ["UTILIDAD BRUTA", "Margen %"]) {
      const card = amounts(container, label);
      expect(within(card).getAllByText("No disponible")).toHaveLength(5);
      expect(card.textContent).not.toContain("MXN");
      expect(card.textContent).not.toContain("No calculable");
    }
  });

  it("preserves offsetting mode values when consolidated income is zero", () => {
    const data = buildEstadoResultados(
      ["Marítimo", "Aéreo"].map((modo, i) => ({ id: `offset-${i}`, modo, tipo_cambio_usd: null, tipo_cambio_eur: null })),
      [100, -100].map((total, i) => ({ embarque_id: `offset-${i}`, descripcion: "Ajustes compensados", total, moneda: "MXN" })),
      [20, 50].map((monto, i) => ({ embarque_id: `offset-${i}`, concepto: "Costo", monto, moneda: "MXN" })),
    );
    const { container } = render(<EstadoResultadosTable data={data} />);
    expectAmounts(amounts(container, "TOTAL INGRESOS"), data.totalIngresos);
    const values = amounts(container, "Margen %").querySelectorAll("dd");
    expect(values[0].textContent).toBe(formatPercent(data.margen.porModo.Marítimo));
    expect(values[1].textContent).toBe(formatPercent(data.margen.porModo.Aéreo));
    expect(values[4].textContent).toBe("No calculable");
  });

  it("shows real losses without a numeric margin when no income exists", () => {
    const data = buildEstadoResultados([{ id: "fixture", modo: "Otros", tipo_cambio_usd: null, tipo_cambio_eur: null }], [],
      [{ embarque_id: "fixture", concepto: "Gasto", monto: 100, moneda: "MXN" }]);
    const { container } = render(<EstadoResultadosTable data={data} />);
    expectAmounts(amounts(container, "UTILIDAD BRUTA"), data.utilidad);
    expect(within(amounts(container, "Margen %")).getAllByText("No calculable")).toHaveLength(5);
    expect(within(mobile(container)).getByText("Sin registros.")).toBeInTheDocument();
  });

  it("keeps MXN and its full signed amount together and leaves room between labels and values", () => {
    const { container } = render(<EstadoResultadosTable data={mobileEerrFixture()} />);
    const values = mobile(container).querySelectorAll("dd");
    expect(values.length).toBeGreaterThan(0);
    values.forEach((value) => {
      expect(value).toHaveClass("whitespace-nowrap", "tabular-nums");
      expect(value.parentElement).toHaveClass("flex-wrap", "gap-x-3");
    });
  });

  it("keeps the desktop header and monetary rows unchanged", () => {
    const data = mobileEerrFixture();
    const { container } = render(<EstadoResultadosTable data={data} />);
    const table = container.querySelector("table")!;
    expect([...table.querySelectorAll("thead th")].map((cell) => cell.textContent))
      .toEqual(["Concepto", ...MODOS_COLUMNAS, "TOTAL"]);
    for (const [label, total] of [["TOTAL INGRESOS", data.totalIngresos], ["TOTAL COSTOS", data.totalCostos], ["UTILIDAD BRUTA", data.utilidad]] as const) {
      const row = within(table).getByText(label).closest("tr")!;
      expect([...row.querySelectorAll("td")].map((cell) => cell.textContent))
        .toEqual([label, ...MODOS_COLUMNAS.map((modo) => fmt(total.porModo[modo])), fmt(total.total)]);
    }
  });

  it("preserves empty-section messages and all mode rows for a zero report", () => {
    const data = buildEstadoResultados([], [], []);
    const { container } = render(<EstadoResultadosTable data={data} />);
    expect(within(mobile(container)).getAllByText("Sin registros.")).toHaveLength(2);
    expectAmounts(amounts(container, "TOTAL INGRESOS"), data.totalIngresos);
    expectAmounts(amounts(container, "TOTAL COSTOS"), data.totalCostos);
    expectAmounts(amounts(container, "UTILIDAD BRUTA"), data.utilidad);
    expect(within(amounts(container, "Margen %")).getAllByText("No calculable")).toHaveLength(5);
  });

  it("keeps long labels accessible without truncation and accepts legacy data without valuation metadata", () => {
    const data = mobileEerrFixture();
    delete data.valuacion;
    const label = "NombreLargoSinEspacios".repeat(8);
    data.ingresos[0].concepto = label;
    const { container } = render(<EstadoResultadosTable data={data} />);
    const card = within(mobile(container)).getByRole("region", { name: label });
    expect(within(card).getByRole("heading", { name: label })).toHaveClass("break-words");
    expectAmounts(card, data.ingresos[0]);
    expectAmounts(amounts(container, "UTILIDAD BRUTA"), data.utilidad);
  });

  it("replaces data and incomplete statuses on repeated period/source renders without modifying inputs", () => {
    const data = mobileEerrFixture();
    const snapshot = JSON.stringify(data);
    const { container, rerender } = render(<EstadoResultadosTable data={data} />);
    rerender(<EstadoResultadosTable data={{ ...data, valuacion: { completa: false, conceptos_sin_tc_count: 1, excluidos_sin_tc: [] } }} />);
    expect(within(amounts(container, "UTILIDAD BRUTA")).getAllByText("No disponible")).toHaveLength(5);
    rerender(<EstadoResultadosTable data={data} />);
    expectAmounts(amounts(container, "UTILIDAD BRUTA"), data.utilidad);
    expect(JSON.stringify(data)).toBe(snapshot);
    expect(within(mobile(container)).queryByText("No disponible")).not.toBeInTheDocument();
  });
});
