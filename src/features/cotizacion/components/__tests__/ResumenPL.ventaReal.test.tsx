import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ResumenPL from "../ResumenPL";
import PasoResumenCotizacion from "../PasoResumenCotizacion";
import { WizardTotalsBar } from "../wizard/WizardTotalsBar";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";

const usd = { totalCosto: 50, totalVenta: 100, profit: 50, porcentaje: 50 };
const mxn = { totalCosto: 0, totalVenta: 0, profit: 0, porcentaje: 0 };
const venta: ConceptoVentaCotizacion = { descripcion: "Coordinación", cantidad: 1, precio_unitario: 150,
  total: 174, aplica_iva: true, tasa_iva_aplicada: 0.16, moneda: "USD", unidad_medida: "Servicio" };
const ventas = [venta, { ...venta, descripcion: "Manual", moneda: "MXN", precio_unitario: 10200, total: 10200, tipo_iva: "no_objeto" }];
const resumen = { totalesUSD: usd, totalesMXN: mxn, tieneUSD: true, tieneMXN: false };

describe("presentación del resumen comercial", () => {
  it("no califica rentabilidad global cuando una moneda activa no tiene venta", () => {
    render(<ResumenPL {...resumen} conceptosVenta={[{ ...venta, precio_unitario: 0 }]} mostrarRentabilidadGlobal />);
    expect(screen.queryByText(/Rentabilidad Baja/i)).not.toBeInTheDocument();
    expect(screen.getByText("No calculable")).toBeInTheDocument();
  });
  it("muestra moneda manual y actualiza un override sin alterar el costeo", () => {
    const { rerender } = render(<ResumenPL {...resumen} conceptosVenta={ventas} />);
    expect(screen.getAllByText("MXN 10,200.00")).toHaveLength(2);
    expect(screen.getByText("USD 150.00")).toBeInTheDocument();
    rerender(<ResumenPL {...resumen} conceptosVenta={[{ ...venta, precio_unitario: 250 }]} />);
    expect(screen.getByText("USD 250.00")).toBeInTheDocument();
    expect(screen.getByText("USD 200.00")).toBeInTheDocument();
    expect(screen.queryByText("MXN")).not.toBeInTheDocument();
    expect(usd.totalVenta).toBe(100);
  });

  it("el paso4 usa conceptos y la moneda manual sin depender de costos en esa moneda", () => {
    render(<PasoResumenCotizacion plUSD={usd} plMXN={mxn} tieneCostosUSD tieneCostosMXN={false}
      conceptosVenta={ventas} nombreCliente="Cliente" origen="Origen" destino="Destino" numContenedores={1}
      modo="Terrestre" incoterm="DAP" tipo="Importación" totalUSD={174} totalMXN={10200} />);
    expect(screen.getByText("USD 150.00")).toBeInTheDocument();
    expect(screen.getByText("USD 100.00")).toBeInTheDocument();
    expect(screen.getByText("MXN")).toBeInTheDocument();
  });

  it.each([{ conceptosDescartados: 1 }, { conceptosVenta: [{ ...venta, cantidad: Number.NaN }] }])("oculta métricas con datos incompletos %j", props => {
    render(<ResumenPL {...resumen} conceptosVenta={[]} {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("datos incompletos");
    expect(screen.queryByText("Venta total")).not.toBeInTheDocument();
  });

  it("no muestra margen de cotización sin desglose", () => {
    render(<ResumenPL {...resumen} conceptosVenta={ventas} sinCostosRegistrados />);
    expect(screen.getByRole("status")).toHaveTextContent("Carga el desglose de costos");
    expect(screen.queryByText("Venta total")).not.toBeInTheDocument();
  });

  it("identifica el fallback de un histórico sin conceptos", () => {
    render(<ResumenPL {...resumen} conceptosVenta={[]} />);
    expect(screen.getByText(/se muestra la estimación del costeo/)).toBeInTheDocument();
    expect(screen.getByText("USD 100.00")).toBeInTheDocument();
  });

  it("barra paso2 mantiene presupuesto y paso3 usa venta neta actual", () => {
    const { rerender } = render(<WizardTotalsBar plUSD={usd} plMXN={mxn} />);
    expect(screen.getByText("USD 100.00")).toBeInTheDocument();
    rerender(<WizardTotalsBar plUSD={usd} plMXN={mxn} conceptosVenta={ventas} />);
    expect(screen.getByText(/USD 150.00/)).toBeInTheDocument();
    expect(screen.getByText("MXN 10,200.00")).toBeInTheDocument();
    expect(screen.getByText(/66.7 %/)).toBeInTheDocument();
    expect(screen.queryByText("USD 174.00")).not.toBeInTheDocument();
  });

  it("barra respeta venta cero y muestra la pérdida en su moneda", () => {
    render(<WizardTotalsBar plUSD={usd} plMXN={mxn} conceptosVenta={[{ ...venta, precio_unitario: 0 }]} />);
    expect(screen.getByText("USD 0.00")).toBeInTheDocument();
    expect(screen.getByText(/Utilidad USD:.*50.00/)).toBeInTheDocument();
    expect(screen.queryByText("USD 100.00")).not.toBeInTheDocument();
    expect(screen.getByText("Margen: no calculable (sin venta capturada)")).toBeInTheDocument();
    expect(screen.queryByText(/0\.0 %/)).not.toBeInTheDocument();
  });
});
