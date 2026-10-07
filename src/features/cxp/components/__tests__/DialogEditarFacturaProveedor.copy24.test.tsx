import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FacturaCxP } from "../../services";
import { DialogEditarFacturaProveedor } from "../DialogEditarFacturaProveedor";

const state = vi.hoisted(() => ({ moneda: "USD", submit: vi.fn() }));
vi.mock("@/features/presupuesto/hooks", () => ({ usePresupuestoCategorias: () => ({ data: [] }) }));
vi.mock("@/features/cxp/hooks", () => ({ useEditarFacturaProveedorForm: () => ({
  values: { moneda: state.moneda, subtotal: "100", iva: "16", retenciones: "0" },
  total: 116, hayCambios: false, isPending: false, isLoadingRow: false, isErrorRow: false, submit: state.submit,
}) }));
vi.mock("../FacturaProveedorFormFields", () => ({ FacturaProveedorFormFields: () => null }));

describe("Copy24 · total del editor con una sola moneda", () => {
  it.each(["USD", "MXN", "EUR"])("muestra Total y %s 116.00 sin cambiar importe ni guardar", (moneda) => {
    state.moneda = moneda;
    const onOpenChange = vi.fn();
    // SAFE-CAST: el hook está simulado; el editor sólo lee estos datos de identidad y contexto.
    const factura = { id: "fixture", folio_interno: "FP-FIXTURE", folio_proveedor: "F-1",
      proveedor_nombre: "Proveedor fixture", estado_aprobacion: "pendiente", moneda, pagado: 0 } as FacturaCxP;
    const { rerender } = render(<DialogEditarFacturaProveedor factura={factura} onOpenChange={onOpenChange} />);
    const check = () => {
      const total = screen.getByText("Total", { exact: true }).parentElement!;
      expect(total).toHaveTextContent(`Total${moneda} 116.00`);
      expect(total.textContent?.match(new RegExp(moneda, "g"))).toHaveLength(1);
      expect(screen.queryByText(`Total ${moneda}`, { exact: true })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    };
    check();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(<DialogEditarFacturaProveedor factura={null} onOpenChange={onOpenChange} />);
    rerender(<DialogEditarFacturaProveedor factura={factura} onOpenChange={onOpenChange} />);
    check();
    expect(state.submit).not.toHaveBeenCalled();
  });
});
