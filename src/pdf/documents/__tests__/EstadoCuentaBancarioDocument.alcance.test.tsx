import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EstadoCuentaBancarioDocument } from "../EstadoCuentaBancarioDocument";

describe("PDF bancario - ámbitos", () => {
  it("rotula por separado el periodo completo y el detalle filtrado", () => {
    const { container } = render(<EstadoCuentaBancarioDocument cuenta="Cuenta sintética" banco="Banco" moneda="MXN" filas={[]}
      resumen={{ periodo: "01/09/2026 - 30/09/2026", saldoInicial: "MXN 1,000.00", entradas: "MXN 116.00", salidas: "MXN 100.00", saldoFinal: "MXN 1,016.00" }}
      alcance={{ filtro: "Búsqueda: A1", movimientosVisibles: 1, movimientosPeriodo: 2, entradas: "MXN 116.00", salidas: "MXN 0.00" }} />);
    expect(container).toHaveTextContent("Resumen de todo el periodo");
    expect(container).toHaveTextContent("Detalle exportado: 1 de 2 movimientos");
    expect(container).toHaveTextContent("Búsqueda: A1");
    expect(container).toHaveTextContent("Entradas visibles: MXN 116.00 | Salidas visibles: MXN 0.00");
    expect(container).toHaveTextContent("saldo corrido real");
  });

  it("conserva la explicación de cobertura parcial del estado de cuenta", () => {
    const cobertura = "El resumen y los movimientos abarcan únicamente del 03/10/2026 al 05/10/2026; el saldo inicial corresponde al arranque.";
    const { container } = render(<EstadoCuentaBancarioDocument cuenta="Cuenta sintética" banco="Banco" moneda="MXN" filas={[]}
      resumen={{ periodo: "03/10/2026 – 05/10/2026", cobertura, saldoInicial: "MXN 1,000.00", entradas: "MXN 50.00", salidas: "MXN 20.00", saldoFinal: "MXN 1,030.00" }} />);
    expect(container).toHaveTextContent(cobertura);
    expect(container).toHaveTextContent("Periodo 03/10/2026 – 05/10/2026");
  });
});
