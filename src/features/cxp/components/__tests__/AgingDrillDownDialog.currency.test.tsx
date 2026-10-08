import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgingDrillDownDialog } from "../AgingDrillDownDialog";
import type { CxpAgingRow } from "../../services/cxpAging";
import { exportarCxpAgingCsv } from "../../services/cxpAgingExport";
import { addDaysIso } from "@/lib/date/dateOnly";

const { fetchMock, csvRows, aggregateCsv } = vi.hoisted(() => ({ fetchMock: vi.fn(), csvRows: vi.fn(), aggregateCsv: vi.fn() }));
vi.mock("@/lib/ui/notifyCsvExport", () => ({ downloadCsvWithFeedback: aggregateCsv }));
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
const factura = (id: string, moneda: string, saldo: number, dias_vencido: number) => ({ id, folio_proveedor: id, moneda, saldo, dias_vencido, fecha_emision: "2026-09-01", fecha_vencimiento: addDaysIso("2026-10-03", -dias_vencido) });

describe("aging CxP: moneda y cubeta del detalle/CSV", () => {
  it("filtra moneda aun con datos cacheados mezclados y exporta sólo filas visibles", () => {
    fetchMock.mockReturnValue({ data: [factura("USD-vencida", "USD", 700, 6), factura("USD-vigente", "USD", 95, 0), factura("MXN-vencida", "MXN", 1160, 6)], isLoading: false });
    vi.stubGlobal("Blob", class { constructor(parts: unknown[]) { csvRows(parts[0]); } });
    const createUrl = vi.fn(() => "blob:test");
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { rerender } = render(<AgingDrillDownDialog proveedor={proveedor} open onOpenChange={() => {}} fechaReferencia="2026-10-03" />);
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
    rerender(<AgingDrillDownDialog proveedor={{ ...proveedor, moneda: "MXN", num_facturas: 1 }} open onOpenChange={() => {}} fechaReferencia="2026-10-03" />);
    expect(screen.getByText("MXN-vencida")).toBeInTheDocument();
    expect(screen.queryByText("USD-vencida")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV 1"));
    expect(csvRows.mock.lastCall?.[0]).not.toContain("USD-vencida");
    // Reabrir la misma entidad restablece "todas", no la última cubeta elegida.
    rerender(<AgingDrillDownDialog proveedor={proveedor} open={false} onOpenChange={() => {}} fechaReferencia="2026-10-03" />);
    rerender(<AgingDrillDownDialog proveedor={proveedor} open onOpenChange={() => {}} fechaReferencia="2026-10-03" />);
    expect(screen.getByText("2 facturas")).toBeInTheDocument();
    expect(screen.getByText("USD-vigente")).toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV 2"));
    expect(csvRows.mock.lastCall?.[0]).toContain("USD-vigente");
  });

  it("reclasifica y exporta a la fecha del reporte en vez de usar los días de hoy", () => {
    fetchMock.mockReturnValue({ data: [factura("USD-referencia", "USD", 95, 0)], isLoading: false });
    vi.stubGlobal("Blob", class { constructor(parts: unknown[]) { csvRows(parts[0]); } });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const props = { proveedor, open: true, onOpenChange: () => {}, cubetaInicial: "d_31_60" as const, fechaReferencia: "2026-11-04" };
    const { rerender } = render(<AgingDrillDownDialog {...props} />);
    expect(screen.getByText("USD-referencia")).toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV 1"));
    expect(csvRows.mock.lastCall?.[0]).toContain("2026-10-03,32,31-60 d,USD,95,2026-11-04,31-60 d");
    rerender(<AgingDrillDownDialog {...props} fechaReferencia="2026-10-03" />);
    expect(screen.queryByText("USD-referencia")).not.toBeInTheDocument();
    expect(screen.getByText("0 facturas")).toBeInTheDocument();
  });

  it("extensión70 conserva las cuatro facturas y 811.945 en CSV agregado y detalle", () => {
    const summary = { ...proveedor, saldo_total: 811.945, vigente: 111.945, d_1_30: 700, num_facturas: 4 };
    const atReportDate = (id: string, saldo: number, dias: number) => ({
      ...factura(id, "USD", saldo, dias), fecha_vencimiento: addDaysIso("2026-10-06", -dias),
    });
    fetchMock.mockReturnValue({ data: [
      atReportDate("USD-700", 700, 6), atReportDate("USD-95", 95, 0),
      atReportDate("FP12", 16, 0), atReportDate("USD-precision", 0.945, 0),
      factura("USD-settled", "USD", 0, 0), factura("MXN-other", "MXN", 1160, 6),
    ], isLoading: false });
    vi.stubGlobal("Blob", class { constructor(parts: unknown[]) { csvRows(parts[0]); } });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<AgingDrillDownDialog proveedor={summary} open onOpenChange={() => {}} fechaReferencia="2026-10-06" />);
    expect(screen.getByText("4 facturas")).toBeInTheDocument();
    expect(screen.getByText("FP12")).toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV 4"));
    const detail = String(csvRows.mock.lastCall?.[0]).split("\n").slice(1);
    expect(detail).toHaveLength(summary.num_facturas);
    expect(detail.reduce((sum, row) => sum + Number(row.split(",")[6]), 0)).toBeCloseTo(summary.saldo_total, 8);
    expect(detail.some(row => row.includes(",USD,0.945,"))).toBe(true);
    const inBucket = (bucket: string) => detail.filter(row => row.split(",")[4] === bucket)
      .reduce((sum, row) => sum + Number(row.split(",")[6]), 0);
    expect(inBucket("Vigente")).toBeCloseTo(summary.vigente, 8);
    expect(inBucket("1-30 d")).toBe(summary.d_1_30);
    exportarCxpAgingCsv([summary], "USD", "2026-10-06");
    expect(aggregateCsv.mock.lastCall?.[0].csv).toContain('"Proveedor",USD,4,111.945,700,0,0,0,811.945,2026-10-06');
  });

});
