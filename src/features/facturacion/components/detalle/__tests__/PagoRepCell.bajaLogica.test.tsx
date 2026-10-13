import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { PagoRow } from "../FacturaPagosTabla";

const mocks = vi.hoisted(() => ({ timbrar: vi.fn(), consultar: vi.fn() }));
vi.mock("@/features/facturacion/hooks", () => ({ useTimbrarRep: () => ({ mutate: mocks.timbrar, isPending: false }) }));
vi.mock("@/features/facturacion/hooks/useConsultarRep", () => ({ useConsultarRep: () => ({ mutate: mocks.consultar, isPending: false }) }));
vi.mock("@/components/shared/Hint", () => ({ Hint: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/features/facturacion/components/FacturaDownloadButton", () => ({ FacturaDownloadButton: ({ kind }: { kind: string }) => <button>Descargar {kind}</button> }));
vi.mock("@/components/shared/DataTable", () => ({ defineColumns: (columns: unknown) => columns }));
vi.mock("@/components/shared/dataTable/ResponsiveDataTable", () => ({ ResponsiveDataTable: ({ columns, data, mobileCard }: { columns: { id: string; cell: (ctx: { row: { original: PagoRow } }) => ReactNode }[]; data: PagoRow[]; mobileCard: (p: PagoRow) => ReactNode }) => <><section aria-label="Desktop">{columns.find((c) => c.id === "rep")!.cell({ row: { original: data[0] } })}</section><section aria-label="Móvil">{mobileCard(data[0])}</section></> }));
import { FacturaPagosTabla } from "../FacturaPagosTabla";

const pago = (estado: string, cancellationStatus?: string): PagoRow => ({ id: "p1", fecha_pago: "2026-10-03", monto: 50, monto_aplicado_factura: 50, moneda: "MXN", forma_pago: "03", estado_rep: estado, serie_rep: "P", folio_rep: 1, rep_cancellation_status: cancellationStatus });
function tabla(estado: string, soloLectura: boolean, cancellationStatus?: string) {
  return <FacturaPagosTabla pagos={[pago(estado, cancellationStatus)]} facturaId="f1" moneda="MXN" canEdit={false} soloLectura={soloLectura} onEliminar={vi.fn()} onCancelarRep={vi.fn()} onPreviewRep={vi.fn()} />;
}

describe("REP: vigencia propagada por tabla y tarjeta móvil", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([["Error", undefined, "Reintentar timbrado del REP"], ["Cancelado", undefined, "Re-timbrar REP (el cancelado queda archivado como antecedente)"], ["Timbrado", "verifying", "Actualizar estado ante el SAT"]])("%s queda sólo lectura al darse de baja", (estado, cancellationStatus, label) => {
    const { rerender } = render(tabla(estado!, false, cancellationStatus));
    expect(screen.getAllByRole("button", { name: label })).toHaveLength(2);
    rerender(tabla(estado!, true, cancellationStatus));
    expect(screen.queryByRole("button", { name: label })).toBeNull();
    expect(mocks.timbrar).not.toHaveBeenCalled();
    expect(mocks.consultar).not.toHaveBeenCalled();
  });
  it("vigente conserva el permiso previo para reintentar REP", () => {
    render(tabla("Error", false));
    fireEvent.click(screen.getAllByRole("button", { name: "Reintentar timbrado del REP" })[0]);
    expect(mocks.timbrar).toHaveBeenCalledWith("p1");
  });
  it("de baja conserva preview y PDF/XML históricos en ambos tamaños", () => {
    render(tabla("Timbrado", true));
    expect(screen.getAllByRole("button", { name: "Previsualizar PDF del REP" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Descargar pdf" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Descargar xml" })).toHaveLength(2);
  });
});
