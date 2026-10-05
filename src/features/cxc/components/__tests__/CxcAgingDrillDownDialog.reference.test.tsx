import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CxcAgingDrillDownDialog } from "../CxcAgingDrillDownDialog";
import type { CxcAgingRow } from "../../services/cxcAging";
import type { FacturaCobranza } from "@/features/facturacion/services/cobranza";

const { cobranza, csv } = vi.hoisted(() => ({ cobranza: vi.fn(), csv: vi.fn() }));
vi.mock("@/features/facturacion/hooks/useCobranza", () => ({ useCobranza: cobranza }));
vi.mock("@/lib/ui/notifyCsvExport", () => ({ downloadCsvWithFeedback: csv }));
vi.mock("@/components/shared/dataTable/ResponsiveDataTable", () => ({
  ResponsiveDataTable: ({ data }: { data: FacturaCobranza[] }) => <div>{data.map(f => <p key={f.id}>{f.numero}:{f.dias_vencido}</p>)}</div>,
}));
vi.mock("../CxcAgingDrillDownDialog.parts", () => ({
  CxcAgingKpiRow: () => null,
  CxcAgingActionBar: ({ onChange, onExport, exportDisabled }: { onChange: (v: string) => void; onExport: () => void; exportDisabled: boolean }) => <div><button onClick={() => onChange("mas_90")}>+90</button><button disabled={exportDisabled} onClick={onExport}>CSV</button></div>,
}));

const cliente: CxcAgingRow = { cliente_id: "c1", cliente_nombre: "Cliente", moneda: "MXN", saldo_total: 116.04, vigente: 0, d_1_30: 0, d_31_60: 116.04, d_61_90: 0, mas_90: 0, num_facturas: 3 };
const facturas = [
  { id: "a3", numero: "A3", moneda: "MXN", saldo: 58, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-02", dias_vencido: 1 },
  { id: "a4", numero: "A4", moneda: "MXN", saldo: 29.04, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-04", dias_vencido: 0 },
  { id: "a5", numero: "A5", moneda: "MXN", saldo: 29, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-04", dias_vencido: 0 },
];

beforeEach(() => { vi.clearAllMocks(); cobranza.mockReturnValue({ data: facturas, isLoading: false }); });

describe("Aging CxC detalle y CSV a la fecha seleccionada", () => {
  it("clasifica las tres facturas en31–60 y exporta33/31/31 al04/11 aunque la consulta de cobranza use hoy", () => {
    render(<CxcAgingDrillDownDialog cliente={cliente} open onOpenChange={() => {}} cubetaInicial="d_31_60" fechaReferencia="2026-11-04" />);
    expect(screen.getByText("A3:33")).toBeInTheDocument();
    expect(screen.getByText("A4:31")).toBeInTheDocument();
    expect(screen.getByText("A5:31")).toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV"));
    expect(csv).toHaveBeenCalledWith(expect.objectContaining({ filename: "aging-cxc-Cliente-2026-11-04.csv", rowCount: 3 }));
    const content: string = csv.mock.lastCall?.[0].csv;
    expect(content).toContain("2026-10-02,33,31-60 d,MXN,58,2026-11-04,31-60 d");
    expect(content).toContain("2026-10-04,31,31-60 d,MXN,29.04,2026-11-04,31-60 d");
    expect(facturas[0].dias_vencido).toBe(1);
  });

  it("restablece la cubeta inicial al reabrir o cambiar la fecha y deshabilita exportación vacía", () => {
    const props = { cliente, open: true, onOpenChange: () => {}, cubetaInicial: "d_31_60" as const, fechaReferencia: "2026-11-04" };
    const { rerender } = render(<CxcAgingDrillDownDialog {...props} />);
    fireEvent.click(screen.getByText("+90"));
    expect(screen.getByText("CSV")).toBeDisabled();
    rerender(<CxcAgingDrillDownDialog {...props} open={false} />);
    rerender(<CxcAgingDrillDownDialog {...props} />);
    expect(screen.getByText("A3:33")).toBeInTheDocument();
    rerender(<CxcAgingDrillDownDialog {...props} fechaReferencia="2026-10-03" />);
    expect(screen.getByText("CSV")).toBeDisabled();
    expect(screen.queryByText("A3:33")).not.toBeInTheDocument();
  });
});
