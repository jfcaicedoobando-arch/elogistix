import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportacionRevisionDialog } from "../ImportacionRevisionDialog";
import { clasificarRevisionImportacion } from "../../domain/import/revisionImportacion";
import type { ImportacionPendiente } from "../../hooks/useImportarEstadoCuenta";
const fila = { fecha: "2026-10-03", concepto: "Depósito proveedor", referencia: "R-123", cargo: 0, abono: 25, saldo: 100, hash_dedupe: "banco" };
const revision: ImportacionPendiente = { archivo: "movimientos.csv", cuenta: { id: "cta", alias: "Operativa", banco: "Banorte", moneda: "MXN" }, movimientos: [fila], sinImporte: 1,
  resumen: clasificarRevisionImportacion([fila], new Set(), [{ id: "e1", cuenta_bancaria_id: "cta", hash_dedupe: "cobro-p1", pago_factura_id: "p1", fecha: fila.fecha, cargo: 0, abono: 25 }]) };
describe("Revisión de archivo bancario", () => {
  it("muestra archivo, destino, fechas, montos y exige reconocer el vínculo", () => {
    const confirmar = vi.fn();
    render(<ImportacionRevisionDialog revision={revision} confirmando={false} onConfirm={confirmar} onCancel={vi.fn()} />);
    expect(screen.getByText("movimientos.csv")).toBeVisible();
    expect(screen.getByText(/Banorte.*Operativa.*MXN/)).toBeVisible();
    expect(screen.getByText(/Fechas interpretadas:/)).toBeVisible();
    expect(screen.getByText(/Totales del archivo:/)).toHaveTextContent("25.00");
    expect(screen.getByText("Depósito proveedor")).toBeVisible();
    const button = screen.getByRole("button", { name: "Confirmar importación" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Revisé las coincidencias/ }));
    expect(button).toBeEnabled(); fireEvent.click(button);
    expect(confirmar).toHaveBeenCalledTimes(1);
  });
  it("cancelar nunca llama a confirmar y un resumen actualizado exige revisión nueva", () => {
    const confirmar = vi.fn(); const cancelar = vi.fn();
    const { rerender } = render(<ImportacionRevisionDialog revision={revision} confirmando={false} onConfirm={confirmar} onCancel={cancelar} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Revisé las coincidencias/ }));
    rerender(<ImportacionRevisionDialog revision={{ ...revision }} confirmando={false} onConfirm={confirmar} onCancel={cancelar} />);
    expect(screen.getByRole("button", { name: "Confirmar importación" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cancelar).toHaveBeenCalledTimes(1); expect(confirmar).not.toHaveBeenCalled();
  });
});
