import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { FILTROS_LIBRO_PAGOS_INICIALES, type PagoLibro } from "../../domain/libroPagos";

const state = vi.hoisted(() => ({ pagos: [] as PagoLibro[], sheet: vi.fn(() => null) }));
vi.mock("@/hooks/shared", () => ({ useDocumentTitle: vi.fn(), useIsMobile: () => true }));
vi.mock("@/features/tesoreria/hooks", () => ({ useCuentasBancarias: () => ({ data: [] }) }));
vi.mock("@/features/tesoreria/hooks/useLibroPagos", () => ({
  useLibroPagos: () => ({ data: { pagos: state.pagos }, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/features/tesoreria/hooks/useFiltrosLibroPagosUrl", () => ({
  useFiltrosLibroPagosUrl: () => ({ rango: { desde: "2026-10-01", hasta: "2026-10-07" },
    filtros: FILTROS_LIBRO_PAGOS_INICIALES, setRango: vi.fn(), actualizarFiltros: vi.fn() }),
}));
vi.mock("@/features/tesoreria/components/DetallePagoSheet", () => ({ DetallePagoSheet: state.sheet }));
vi.mock("../_sections/LibroPagosToolbar", () => ({ LibroPagosToolbar: () => null }));
vi.mock("../_sections/LibroPagosExportButtons", () => ({ LibroPagosExportButtons: () => null }));

import TesoreriaPagos from "../TesoreriaPagos";

const base: PagoLibro = {
  id: "ajuste", tipo: "pago", fecha: "2026-10-06", contraparte: "Proveedor ajuste", contraparte_id: null,
  documento_id: null, documento_folio: "FP-AJUSTE", moneda: "MXN", monto: 1, tipo_cambio: null, monto_mxn: 1,
  metodo_pago: "Ajuste", referencia: null, cuenta_bancaria_id: null, cuenta_alias: null, cuenta_banco: null,
  notas: null, embarque_id: null, diferencia_cambiaria_mxn: 0, estado_rep: null, folio_rep: null,
  es_ajuste: true, es_anticipo_aplicado: false, lote_id: null, conciliado: false, movimiento_id: null, created_at: null,
};

describe("AUD99/121 · pantalla de pagos en móvil", () => {
  beforeEach(() => {
    state.sheet.mockClear();
    state.pagos = [base, { ...base, id: "ordinario", contraparte: "Proveedor pago", documento_folio: "FP-PAGO",
      es_ajuste: false, metodo_pago: "03", referencia: "Cierre sin pago: condonacion", monto: 116, monto_mxn: 116 }];
  });

  it.each([
    ["Ajuste no monetario", "Proveedor ajuste", "ajuste", "Importe ajustado", "MXN 1.00"],
    ["Pago a proveedor", "Proveedor pago", "ordinario", "Monto", "MXN 116.00"],
  ])("%s tiene nombre accesible correcto y abre el mismo registro", (tipo, contraparte, id, etiquetaMonto, monto) => {
    render(<MemoryRouter><TesoreriaPagos /></MemoryRouter>);
    const row = screen.getByRole("button", { name: `Ver detalle: ${tipo} · ${contraparte}` });
    expect(within(row).getByText(tipo)).toBeVisible();
    expect(within(row).getByText(etiquetaMonto)).toBeVisible();
    expect(within(row).getByText(monto)).toBeVisible();
    if (id === "ajuste") {
      expect(within(row).queryByText("Pago", { exact: true })).not.toBeInTheDocument();
      expect(within(row).queryByText("Pago a proveedor")).not.toBeInTheDocument();
    }
    fireEvent.click(row);
    expect(state.sheet).toHaveBeenLastCalledWith(expect.objectContaining({ ref_pago: { tipo: "pago", id } }), undefined);
    expect(state.pagos.map((p) => p.monto)).toEqual([1, 116]);
  });
});
