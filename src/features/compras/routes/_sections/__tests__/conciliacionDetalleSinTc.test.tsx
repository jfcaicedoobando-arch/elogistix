import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { buildFilasReconciliacion, calcularResumenPorEstatus, calcularResumenPorMoneda } from "@/features/embarques/services/reconciliacionCostos.helpers";
import { CuerpoTabla, ResumenGrid } from "../ConciliacionDetalleSections";

const filas = buildFilasReconciliacion(
  [{ id: "a", concepto: "Flete", proveedor_nombre: "Logística Regia", moneda: "USD", monto: 100, estado_liquidacion: "Pendiente" }],
  [{ monto: 872.61, concepto_costo_id: "a", descripcion: "Flete MTY", proveedor_facturas: { id: "f1", folio_proveedor: "MTY-1", estado: "Vigente", moneda: "MXN", tipo_cambio_usd: null, deleted_at: null } }],
);
const totales = calcularResumenPorMoneda(filas);

describe("ConciliacionDetalle sin TC", () => {
  it("KPI y footer muestran N/D y pendientes, no ahorro", () => {
    render(<ResumenGrid totalesPorMoneda={totales} resumenEstatus={calcularResumenPorEstatus(filas)} huerfanas={0} />);
    const kpi = screen.getByTestId("kpi-moneda-USD");
    expect(within(kpi).getAllByText("N/D")).toHaveLength(2);
    expect(screen.getByText("Pendiente de TC")).toBeInTheDocument();
  });

  it("fila N/D y factura en MXN con motivo", () => {
    render(<CuerpoTabla isLoading={false} filas={filas} expandidos={new Set(["a"])} onToggle={() => {}} onVincular={() => {}} totalesPorMoneda={totales} />);
    const partida = screen.getByTestId("partida-excluida");
    expect(partida.textContent).toMatch(/872\.61/);
    expect(partida.textContent).toMatch(/sin tipo de cambio/);
    expect(partida.textContent).not.toMatch(/\$0\.00/);
    const footer = screen.getByTestId("total-moneda-USD");
    expect(footer.textContent).toMatch(/N\/D/);
    expect(footer.textContent).toMatch(/pendiente\(s\) de tipo de cambio/);
  });
});
