import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgingDrillDownDialog } from "../AgingDrillDownDialog";
import type { CxpAgingRow } from "../../services/cxpAging";

const { fetchMock, csvRows } = vi.hoisted(() => ({ fetchMock: vi.fn(), csvRows: vi.fn() }));
vi.mock("@/features/cxp/hooks", () => ({ useFacturasCxP: fetchMock }));
vi.mock("@/components/shared/DataTable", () => ({
  defineColumns: (columns: unknown) => columns,
  DataTable: ({ data }: { data: { id: string; folio_proveedor: string }[] }) => <div>{data.map(f => <span key={f.id}>{f.folio_proveedor}</span>)}</div>,
}));
vi.mock("../AgingDrillDownDialog.parts", () => ({
  AgingKpiRow: () => null,
  AgingActionBar: ({ onChange, onExport, exportCount }: { onChange: (v: string) => void; onExport: () => void; exportCount: number }) => <div><button onClick={() => onChange("d_1_30")}>Vencidas</button><button onClick={onExport}>CSV {exportCount}</button></div>,
}));
const proveedor: CxpAgingRow = { proveedor_id: "p", proveedor_nombre: "Proveedor", moneda: "USD", saldo_total: 795, vigente: 95, d_1_30: 700, d_31_60: 0, d_61_90: 0, mas_90: 0, num_facturas: 2 };
const factura = (id: string, moneda: string, saldo: number, dias_vencido: number) => ({ id, folio_proveedor: id, moneda, saldo, dias_vencido, fecha_emision: "2026-10-03", fecha_vencimiento: "2026-10-03" });

describe("aging CxP: moneda y cubeta del detalle/CSV", () => {
  it("filtra moneda aun con datos cacheados mezclados y exporta sólo filas visibles", () => {
    fetchMock.mockReturnValue({ data: [factura("USD-vencida", "USD", 700, 6), factura("USD-vigente", "USD", 95, 0), factura("MXN-vencida", "MXN", 1160, 6)], isLoading: false });
    vi.stubGlobal("Blob", class { constructor(parts: unknown[]) { csvRows(parts[0]); } });
    const createUrl = vi.fn(() => "blob:test");
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { rerender } = render(<AgingDrillDownDialog proveedor={proveedor} open onOpenChange={() => {}} />);
    expect(fetchMock).toHaveBeenLastCalledWith({ proveedor_id: "p", moneda: "USD" });
    expect(screen.queryByText("MXN-vencida")).not.toBeInTheDocument();
    expect(screen.getByText("2 facturas")).toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV 2"));
    expect(csvRows.mock.lastCall?.[0]).toContain("USD-vigente");
    expect(csvRows.mock.lastCall?.[0]).not.toContain("MXN-vencida");
    fireEvent.click(screen.getByText("Vencidas"));
    expect(screen.getByText("1 factura")).toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV 1"));
    expect(csvRows.mock.lastCall?.[0]).toContain("USD-vencida");
    expect(csvRows.mock.lastCall?.[0]).not.toContain("USD-vigente");
    rerender(<AgingDrillDownDialog proveedor={{ ...proveedor, moneda: "MXN", num_facturas: 1 }} open onOpenChange={() => {}} />);
    expect(screen.getByText("MXN-vencida")).toBeInTheDocument();
    expect(screen.queryByText("USD-vencida")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV 1"));
    expect(csvRows.mock.lastCall?.[0]).not.toContain("USD-vencida");
    // Reabrir la misma entidad restablece "todas", no la última cubeta elegida.
    rerender(<AgingDrillDownDialog proveedor={proveedor} open={false} onOpenChange={() => {}} />);
    rerender(<AgingDrillDownDialog proveedor={proveedor} open onOpenChange={() => {}} />);
    expect(screen.getByText("2 facturas")).toBeInTheDocument();
    expect(screen.getByText("USD-vigente")).toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV 2"));
    expect(csvRows.mock.lastCall?.[0]).toContain("USD-vigente");
  });
});
