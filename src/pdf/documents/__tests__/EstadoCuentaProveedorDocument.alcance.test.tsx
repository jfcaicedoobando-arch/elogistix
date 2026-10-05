import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EstadoCuentaProveedorDocument } from "../EstadoCuentaProveedorDocument";

describe("PDF proveedor: alcance de saldos (74)", () => {
  it("distingue saldo global de movimientos al cierre e incluye apertura por moneda", () => {
    const { container } = render(<EstadoCuentaProveedorDocument
      proveedorNombre="Proveedor sintético" desde="2026-10-01" hasta="2026-10-03"
      movimientos={[{ fecha: "2026-10-03", tipo: "Factura", folio: "FP-12", expediente: "", referencia: "",
        moneda: "MXN", cargo: "3", abono: "0", saldo: "4146.10" }]}
      aging={[]} saldos={[{ moneda: "MXN", cargos: "4149.10", abonos: "0", saldo: "4149.10" }]}
      saldoApertura={[{ moneda: "MXN", saldo: "4143.10" }, { moneda: "USD", saldo: "16" }]} />);
    expect(container).toHaveTextContent("Saldo global al día de hoy (sin filtro de periodo)");
    expect(container).toHaveTextContent("Saldo inicial del periodo");
    expect(container).toHaveTextContent("4,143.10");
    expect(container).toHaveTextContent("USD");
    expect(container).toHaveTextContent("4,146.10");
    expect(container).toHaveTextContent("4,149.10");
    expect(container).not.toHaveTextContent("Saldo final");
  });

  it("identifica apertura cero y detalle parcial sin afirmar un cierre calculado", () => {
    const { container } = render(<EstadoCuentaProveedorDocument
      proveedorNombre="Proveedor sintético" desde="2026-10-01" hasta="2026-10-03"
      movimientos={[]} aging={[]} saldos={[]} hayMas totalMovimientos={501} />);
    expect(container).toHaveTextContent("saldo inicial cero");
    expect(container).toHaveTextContent("Detalle parcial: 0 de 501 movimientos");
    expect(container).toHaveTextContent("No representa el cierre del periodo seleccionado");
  });
});
