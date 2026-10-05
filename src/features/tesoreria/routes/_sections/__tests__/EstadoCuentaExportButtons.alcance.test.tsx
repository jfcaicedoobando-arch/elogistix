import type { ReactElement, ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EstadoCuentaBancarioDocument } from "@/pdf/documents/EstadoCuentaBancarioDocument";
import type { EstadoCuentaBancario, MovimientoEstadoCuenta } from "@/features/tesoreria/domain/estadoCuenta";
import { EstadoCuentaExportButtons } from "../EstadoCuentaExportButtons";

const mocks = vi.hoisted(() => ({ pdf: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: mocks.pdf }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));

const movimiento: MovimientoEstadoCuenta = { id: "A1", fecha: "2026-09-30", concepto: "Cobro A1", referencia: "A1", cargo: 0, abono: 116, estado_conciliacion: "Pendiente", saldo_corrido: 1016, pago_factura_id: null, pago_proveedor_id: null, anticipo_proveedor_id: null, pago_proveedor_lote_id: null };
const estado: EstadoCuentaBancario = { cuenta_id: "fixture", alias: "Cuenta sintética", banco: "Banco", moneda: "MXN", desde: "2026-09-01", desde_solicitado: "2026-09-01", cobertura_historica: "completa", hasta: "2026-09-30", saldo_inicial: 1000, total_entradas: 116, total_salidas: 100, saldo_final: 1016, fecha_saldo_inicial: null, movimientos_previos_corte: 0, movimientos: [{ ...movimiento, id: "FP", cargo: 100, abono: 0, saldo_corrido: 900 }, movimiento] };

describe("Descarga PDF - estado de cuenta filtrado", () => {
  it("entrega al documento filtro, ambos ámbitos y sólo los movimientos visibles", async () => {
    render(<EstadoCuentaExportButtons estado={estado} movimientos={[movimiento]} filtros={{ texto: "A1", tipo: "entradas" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(mocks.pdf).toHaveBeenCalledOnce());
    const [documento, nombre] = mocks.pdf.mock.calls[0] as [ReactElement<ComponentProps<typeof EstadoCuentaBancarioDocument>>, string];
    expect(nombre).toBe("estado-cuenta-cuenta-sintetica-2026-09-01-2026-09-30.pdf");
    expect(documento.props.filas).toHaveLength(1);
    expect(documento.props.resumen).toMatchObject({ salidas: "MXN 100.00", saldoFinal: "MXN 1,016.00" });
    expect(documento.props.alcance).toMatchObject({ filtro: "Búsqueda: A1 | Tipo: entradas", movimientosVisibles: 1, movimientosPeriodo: 2, salidas: "MXN 0.00" });
  });
});
