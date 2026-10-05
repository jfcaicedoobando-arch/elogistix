import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EstadoCuentaBancario } from "@/features/tesoreria/domain/estadoCuenta";
import { EstadoCuentaResumen } from "../EstadoCuentaResumen";
import { EstadoCuentaExportButtons } from "../EstadoCuentaExportButtons";
import { EstadoCuentaMovimientosResumen } from "../EstadoCuentaMovimientosResumen";

const estado: EstadoCuentaBancario = {
  cuenta_id: "cuenta", alias: "Operativa", banco: "Banco", moneda: "MXN",
  desde: "2026-10-01", desde_solicitado: "2026-10-01", hasta: "2026-10-02",
  fecha_saldo_inicial: "2026-10-03", cobertura_historica: "sin_cobertura",
  saldo_inicial: null, total_entradas: null, total_salidas: null, saldo_final: null,
  movimientos_previos_corte: 0, movimientos: [],
};

describe("Resumen bancario: cobertura histórica (86)", () => {
  it("muestra importes no disponibles con fecha de inicio y exportaciones deshabilitadas", () => {
    render(<><EstadoCuentaResumen estado={estado} isLoading={false} />
      <EstadoCuentaMovimientosResumen estado={estado} visibles={[]} moneda="MXN" />
      <EstadoCuentaExportButtons estado={estado} movimientos={[]} filtros={{ texto: "", tipo: "todos" }} /></>);
    expect(screen.getAllByText("No disponible")).toHaveLength(4);
    expect(screen.queryByText("MXN 0.00")).not.toBeInTheDocument();
    expect(screen.queryByText("MXN 1,000.00")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No hay cobertura histórica");
    expect(screen.getByRole("status")).toHaveTextContent("03/10/2026");
    expect(screen.getByText(/Historial no disponible/)).toBeInTheDocument();
    expect(screen.queryByText(/Entradas visibles/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 de 0 movimientos/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
  });

  it("actualiza cifras y alcance al cambiar de periodo anterior a cruce y luego válido", () => {
    const { rerender } = render(<EstadoCuentaResumen estado={estado} isLoading={false} />);
    const parcial: EstadoCuentaBancario = { ...estado, desde: "2026-10-03", hasta: "2026-10-05", cobertura_historica: "parcial", saldo_inicial: 1000, total_entradas: 50, total_salidas: 20, saldo_final: 1030 };
    rerender(<EstadoCuentaResumen estado={parcial} isLoading={false} />);
    expect(screen.queryByText("No disponible")).not.toBeInTheDocument();
    expect(screen.getByText("MXN 1,000.00")).toBeInTheDocument();
    expect(screen.getByText("MXN 1,030.00")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("únicamente del 03/10/2026 al 05/10/2026");
    expect(screen.getByRole("status")).toHaveTextContent("saldo inicial corresponde al arranque");
    rerender(<EstadoCuentaResumen estado={{ ...parcial, desde_solicitado: "2026-10-03", cobertura_historica: "completa" }} isLoading={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("MXN 1,030.00")).toBeInTheDocument();
    rerender(<EstadoCuentaResumen estado={estado} isLoading={false} />);
    expect(screen.getAllByText("No disponible")).toHaveLength(4);
  });

  it("un rango cubierto vacío sí conserva los totales visibles cero", () => {
    render(<EstadoCuentaMovimientosResumen estado={{ ...estado, cobertura_historica: "completa" }} visibles={[]} moneda="MXN" />);
    expect(screen.getByText(/0 de 0 movimientos/)).toBeInTheDocument();
    expect(screen.getByText(/Entradas visibles MXN 0.00/)).toBeInTheDocument();
  });
});
