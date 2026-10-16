import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CxcAgingDrillDownDialog } from "../CxcAgingDrillDownDialog";
import type { CxcAgingRow } from "../../services/cxcAging";
import type { FacturaCobranza } from "@/features/facturacion/services/cobranza";

const { cobranza, csv } = vi.hoisted(() => ({ cobranza: vi.fn(), csv: vi.fn() }));
vi.mock("@/features/facturacion/hooks/useCobranza", () => ({ useCobranza: cobranza }));
vi.mock("@/lib/ui/notifyCsvExport", () => ({ downloadCsvWithFeedback: csv }));
vi.mock("@/lib/formatters", () => ({ formatDate: (date: string) => date }));
vi.mock("../cxcAgingDrillDownColumns", () => ({ buildCxcAgingDrillDownColumns: () => [] }));
vi.mock("../CxcAgingDrillDownMobileCard", () => ({ CxcAgingDrillDownMobileCard: () => null }));
vi.mock("@/components/shared/dataTable/ResponsiveDataTable", () => ({
  ResponsiveDataTable: ({ data, isLoading, emptyMessage }: { data: FacturaCobranza[]; isLoading: boolean; emptyMessage: string }) =>
    <div>{isLoading ? "Cargando facturas" : data.length ? data.map(f => <p key={f.id}>{f.numero}:{f.dias_vencido}</p>) : emptyMessage}</div>,
}));
vi.mock("../CxcAgingDrillDownDialog.parts", () => ({
  CxcAgingKpiRow: () => null,
  CxcAgingActionBar: ({ onChange, onExport, exportDisabled }: { onChange: (v: string) => void; onExport: () => void; exportDisabled: boolean }) => <div><button onClick={() => onChange("mas_90")}>+90</button><button disabled={exportDisabled} onClick={onExport}>CSV</button><button onClick={onExport}>Invocar exportación</button></div>,
}));

const cliente: CxcAgingRow = { cliente_id: "c1", cliente_nombre: "Cliente", moneda: "MXN", saldo_total: 116.04, vigente: 0, d_1_30: 0, d_31_60: 116.04, d_61_90: 0, mas_90: 0, num_facturas: 3 };
const facturas = [
  { id: "a3", numero: "A3", moneda: "MXN", saldo: 58, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-02", dias_vencido: 1 },
  { id: "a4", numero: "A4", moneda: "MXN", saldo: 29.04, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-04", dias_vencido: 0 },
  { id: "a5", numero: "A5", moneda: "MXN", saldo: 29, fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-04", dias_vencido: 0 },
];

const retry = vi.fn();
const query = (overrides = {}) => ({ data: facturas, isLoading: false, isFetching: false,
  isLoadingError: false, isRefetchError: false, isError: false, error: null, refetch: retry, ...overrides });
const props = { cliente, open: true, onOpenChange: () => {}, fechaReferencia: "2026-11-04" };
beforeEach(() => { vi.clearAllMocks(); cobranza.mockReturnValue(query()); });

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

describe("Aging CxC: errores del listado y reintento", () => {
  it.each([
    [new Error("red"), "No se pudo completar la consulta"],
    [{ code: "LC_RESULTADO_TRUNCADO" }, "La consulta puede estar incompleta"],
  ])("error inicial %j no es Sin facturas ni exporta", (error, message) => {
    cobranza.mockReturnValue(query({ data: undefined, isLoadingError: true, isError: true, error }));
    render(<CxcAgingDrillDownDialog {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("Sin facturas con saldo")).not.toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeDisabled();
    fireEvent.click(screen.getByText("Invocar exportación"));
    expect(csv).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("preserva filas anteriores con aviso y reanuda exportación tras recuperar la consulta", () => {
    cobranza.mockReturnValue(query({ isRefetchError: true, isError: true, error: new Error("refresco") }));
    const view = render(<CxcAgingDrillDownDialog {...props} />);
    expect(screen.getByText("A3:33")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("no están actualizados");
    fireEvent.click(screen.getByText("Invocar exportación"));
    expect(csv).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledOnce();
    cobranza.mockReturnValue(query({ isRefetchError: true, isError: true, isFetching: true }));
    view.rerender(<CxcAgingDrillDownDialog {...props} />);
    expect(screen.getByRole("button", { name: "Reintentando…" })).toBeDisabled();
    cobranza.mockReturnValue(query());
    view.rerender(<CxcAgingDrillDownDialog {...props} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV"));
    expect(csv).toHaveBeenCalledOnce();
  });

  it("ignora un fallo exclusivo de KPIs de useCobranza: el detalle y CSV usan facturas válidas", () => {
    cobranza.mockReturnValue(query({ isError: true, kpisIsError: true, error: new Error("RPC de KPI") }));
    render(<CxcAgingDrillDownDialog {...props} />);
    expect(screen.getByText("A3:33")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("CSV"));
    expect(csv).toHaveBeenCalledOnce();
  });

  it("una consulta vacía correcta sí muestra Sin facturas", () => {
    cobranza.mockReturnValue(query({ data: [] }));
    render(<CxcAgingDrillDownDialog {...props} />);
    expect(screen.getByText("Sin facturas con saldo")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeDisabled();
  });

  it("tras fallar una consulta previamente vacía no muestra un vacío confirmado", () => {
    cobranza.mockReturnValue(query({ data: [], isRefetchError: true, isError: true }));
    render(<CxcAgingDrillDownDialog {...props} />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByText("Sin facturas con saldo")).not.toBeInTheDocument();
  });

  it.each([{ isLoading: true }, { isFetching: true }])("no exporta mientras consulta %j", state => {
    cobranza.mockReturnValue(query(state));
    render(<CxcAgingDrillDownDialog {...props} />);
    expect(screen.getByText("CSV")).toBeDisabled();
    fireEvent.click(screen.getByText("Invocar exportación"));
    expect(csv).not.toHaveBeenCalled();
  });
});

