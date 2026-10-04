import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "@/components/shared/DataTable";
import { buildComisionesColumns } from "../comisionesColumns";
import type { ComisionDevengada } from "../../services/devengadas";
const row: ComisionDevengada = {
  id: "c1", organization_id: "org", pago_factura_id: "p1", embarque_id: null, factura_id: "f1",
  vendedora_id: null, vendedora_nombre: null, factura_numero: "A1", cliente_nombre: "Aceros", expediente: null,
  monto_cobrado_mxn: 116, utilidad_prorrateada_mxn: 0, porcentaje_aplicado: 0, comision_mxn: 0,
  estado: "Devengada", liquidacion_id: null, nota: "Sin embarque asociado", created_at: "2026-10-03T12:00:00Z",
};
const renderRow = (data: ComisionDevengada) => {
  render(<DataTable columns={buildComisionesColumns()} data={[data]} rowKey={(r) => r.id} />);
  return within(screen.getAllByRole("row")[1]);
};
describe("47 · presentación de cobro y comisión independientes", () => {
  it("muestra cobro conocido y comisión no calculada con su motivo", () => {
    const cells = renderRow(row);
    expect(cells.getByText("MXN 116.00")).toBeInTheDocument();
    expect(cells.getAllByText("No calculada")).toHaveLength(2);
    expect(cells.getAllByText("Sin embarque asociado").length).toBeGreaterThan(0);
    expect(cells.queryByText("MXN 0.00")).not.toBeInTheDocument();
  });
  it("muestra No calculado cuando el equivalente cobrado MXN es desconocido", () => {
    const cells = renderRow({ ...row, monto_cobrado_mxn: null });
    expect(cells.getByText("No calculado")).toBeInTheDocument();
    expect(cells.queryByText("MXN 0.00")).not.toBeInTheDocument();
  });
  it("conserva una comisión cero calculada con embarque", () => {
    const cells = renderRow({ ...row, embarque_id: "e1" });
    expect(cells.queryByText("No calculada")).not.toBeInTheDocument();
    expect(cells.getAllByText("MXN 0.00")).toHaveLength(2);
  });
});
