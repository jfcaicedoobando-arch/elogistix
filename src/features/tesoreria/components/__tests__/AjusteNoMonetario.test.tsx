import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { DataTable } from "@/components/shared/DataTable";
import type { PagoLibro } from "../../domain/libroPagos";
import type { PagoDetalle, RefPago } from "../../domain/pagoDetalle";
import { libroPagosColumns } from "../../routes/_sections/libroPagosColumns";
import { DetallePagoSheet } from "../DetallePagoSheet";

const { detalle } = vi.hoisted(() => ({ detalle: vi.fn() }));
vi.mock("../../hooks/usePagoDetalle", () => ({ usePagoDetalle: detalle }));

const ajuste: PagoLibro = {
  id: "ajuste", tipo: "pago", fecha: "2026-10-06", contraparte: "Proveedor fixture",
  contraparte_id: null, documento_id: null, documento_folio: "FP-FIXTURE", moneda: "MXN", monto: 1,
  tipo_cambio: null, monto_mxn: 1, metodo_pago: "Ajuste", referencia: "Cierre sin pago: condonacion",
  cuenta_bancaria_id: null, cuenta_alias: null, cuenta_banco: null, notas: null, embarque_id: null,
  diferencia_cambiaria_mxn: 0, estado_rep: null, folio_rep: null, es_ajuste: true,
  es_anticipo_aplicado: false, lote_id: null, conciliado: false, movimiento_id: null, created_at: null,
};

describe("AUD99/121 · presentación visible del ajuste", () => {
  it("la fila dice Ajuste no monetario / No aplica y conserva el importe sin color de salida", () => {
    render(<DataTable columns={libroPagosColumns()} data={[ajuste]} rowKey={(pago) => pago.id} />);
    const row = screen.getByText("FP-FIXTURE").closest("tr")!;
    expect(within(row).getByText("Ajuste no monetario")).toBeVisible();
    expect(within(row).getByText("No aplica")).toBeVisible();
    expect(within(row).queryByText("Pago", { exact: true })).not.toBeInTheDocument();
    expect(within(row).queryByText("Pendiente")).not.toBeInTheDocument();
    expect(within(row).getAllByText("MXN 1.00")[0]).not.toHaveClass("text-destructive");
  });

  it.each(["MXN", "USD", "EUR"])("el detalle %s no llama dinero al ajuste ni exige banco/TC, incluso al reabrir", (moneda) => {
    const data: PagoDetalle = { tipo: "pago", movimiento: null, aplicaciones: [], pago: {
      ...ajuste, moneda, monto_mxn: moneda === "MXN" ? 1 : null, estado: null, saldo_disponible: null, created_by: null,
    } };
    detalle.mockImplementation((ref: RefPago | null) => ({ data: ref ? data : undefined, isLoading: false, isError: false, refetch: vi.fn() }));
    const onOpenChange = vi.fn();
    const ref = { tipo: "pago", id: ajuste.id } as const;
    const view = (ref_pago: RefPago | null) => <MemoryRouter><DetallePagoSheet ref_pago={ref_pago} onOpenChange={onOpenChange} /></MemoryRouter>;
    const { rerender } = render(view(ref));
    const check = () => {
      expect(screen.getByRole("heading", { name: "Detalle del ajuste" })).toBeVisible();
      expect(screen.getByText("Importe ajustado")).toBeVisible();
      expect(screen.getByText(/Ajuste no monetario: no genera movimiento/)).toBeVisible();
      expect(screen.queryByText("Dinero pagado")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Ir a Conciliación bancaria" })).not.toBeInTheDocument();
      expect(screen.getByText(`${moneda} 1.00`)).toBeVisible();
      expect(screen.queryByText(/Sin T.C registrado:/)).not.toBeInTheDocument();
    };
    check();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(view(null));
    rerender(view(ref));
    check();
    expect(data.pago.monto).toBe(1);
  });
  it.each(["Conciliado", "Pendiente"])("conserva un vínculo histórico %s como incidencia, sin validar su conciliación", (estado) => {
    const data: PagoDetalle = { tipo: "pago", aplicaciones: [], pago: {
      ...ajuste, cuenta_bancaria_id: "cuenta-historica", cuenta_alias: "Cuenta histórica", estado: null, saldo_disponible: null, created_by: null,
    }, movimiento: {
      id: "mov-historico", fecha: "2026-10-06", concepto: "Evidencia histórica", referencia: "LEGADO-99",
      cargo: 1, abono: 0, saldo: null, estado_conciliacion: estado,
      cuenta_bancaria_id: "cuenta-historica", cuenta_alias: "Cuenta histórica", cuenta_banco: null,
      conciliado_por: "actor-historico", conciliado_at: "2026-10-06T18:00:00Z",
    } };
    const original = structuredClone(data);
    detalle.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() });
    render(<MemoryRouter><DetallePagoSheet ref_pago={{ tipo: "pago", id: ajuste.id }} onOpenChange={vi.fn()} /></MemoryRouter>);
    const warning = screen.getByRole("alert");
    expect(within(warning).getByText("Vínculo bancario por revisar")).toBeVisible();
    expect(within(warning).getByText(/Conciliación del ajuste: No aplica/)).toBeVisible();
    expect(within(warning).getByText("Evidencia histórica")).toBeVisible();
    expect(within(warning).getByText("Ref. LEGADO-99")).toBeVisible();
    expect(within(warning).getByText(`Estado histórico registrado: ${estado}`)).toBeVisible();
    expect(within(warning).getByText(/Cargo registrado: MXN 1.00 · Abono registrado: MXN 0.00/)).toBeVisible();
    expect(within(warning).getByText(/Marca histórica de conciliación:/)).toBeVisible();
    expect(within(warning).getByRole("link", { name: "Revisar vínculo en el estado de cuenta" }))
      .toHaveAttribute("href", "/tesoreria/estado-cuenta?cuenta=cuenta-historica");
    expect(screen.queryByText(estado, { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Conciliado el /)).not.toBeInTheDocument();
    expect(screen.queryByText("Dinero pagado")).not.toBeInTheDocument();
    expect(data).toEqual(original);
  });

});
