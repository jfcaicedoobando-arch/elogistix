import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";

const snapshot = { costos: [{ id: "c1", cotizacion_id: "cot1", concepto: "Coordinación", moneda: "USD",
  proveedor: "Proveedor", cantidad: 1, costo_unitario: 50, costo_total: 50, precio_venta: 100,
  unidad_medida: "Servicio", notas: "", created_at: "", updated_at: "" }], updatedAt: "2026-10-09T10:00:00Z" };
vi.mock("@/features/cotizacion/hooks", () => ({
  useCotizacionCostosSnapshot: () => ({ data: snapshot, isLoading: false }),
  useUpsertCotizacionCostos: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCotizacion: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canEdit: true, canWriteCotizaciones: true }) }));
vi.mock("@/features/catalogos/hooks", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));
import SeccionCostosInternosPLDetalle from "../SeccionCostosInternosPLDetalle";

const usd: ConceptoVentaCotizacion = { descripcion: "Coordinación", moneda: "USD", cantidad: 1,
  precio_unitario: 150, unidad_medida: "Servicio", total: 150, aplica_iva: false };
const mxn: ConceptoVentaCotizacion = { ...usd, descripcion: "Manual", moneda: "MXN", precio_unitario: 10200, total: 10200, tipo_iva: "no_objeto" };

describe("utilidad del detalle con venta cliente vigente", () => {
  it("no informa utilidad de costeo cuando el parser descartó los conceptos", () => {
    render(<SeccionCostosInternosPLDetalle cotizacionId="cot1" conceptosUSD={[]} conceptosMXN={[]}
      conceptosDescartados={1} estadoCotizacion="Borrador" />);
    expect(screen.getByRole("status")).toHaveTextContent("datos incompletos");
    expect(screen.queryByRole("button", { name: /Resumen de utilidad/ })).not.toBeInTheDocument();
  });
  it("incluye override USD y manual MXN sin alterar la tabla editable de costeo", () => {
    render(<SeccionCostosInternosPLDetalle cotizacionId="cot1" conceptosUSD={[usd]} conceptosMXN={[mxn]} estadoCotizacion="Borrador" />);
    const resumen = within(screen.getByRole("button", { name: /Resumen de utilidad/ }).parentElement!);
    expect(resumen.getByText("USD 150.00")).toBeInTheDocument();
    expect(resumen.getByText("USD 100.00")).toBeInTheDocument();
    expect(resumen.getAllByText("MXN 10,200.00")).toHaveLength(2);
    const tabla = within(screen.getByRole("table", { name: "Costos de escritorio en USD" }));
    expect(tabla.getAllByText("USD 100.00")).toHaveLength(2);
    expect(tabla.queryByText("USD 150.00")).not.toBeInTheDocument();
  });
});
