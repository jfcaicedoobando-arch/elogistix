/**
 * BotonVerPago: sólo ofrece drill-down cuando el movimiento está conciliado
 * y guarda el pago con el que quedó amarrado.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BotonVerPago } from "../BotonVerPago";

function renderBoton(
  movimiento: Parameters<typeof BotonVerPago>[0]["movimiento"],
  onVerPago = vi.fn(),
) {
  render(
    <TooltipProvider>
      <BotonVerPago movimiento={movimiento} onVerPago={onVerPago} />
    </TooltipProvider>,
  );
  return onVerPago;
}

describe("BotonVerPago", () => {
  it("no muestra botón si el movimiento está pendiente", () => {
    renderBoton({ estado_conciliacion: "Pendiente", pago_factura_id: "pf" });
    expect(screen.queryByRole("button", { name: /ver pago/i })).toBeNull();
  });

  it("avisa cuando está conciliado pero sin pago vinculado", () => {
    renderBoton({ estado_conciliacion: "Conciliado" });
    expect(screen.queryByRole("button", { name: /ver pago/i })).toBeNull();
    expect(screen.getByText(/sin pago vinculado/i)).toBeInTheDocument();
  });

  it("abre el detalle del pago vinculado", async () => {
    const onVerPago = renderBoton({
      estado_conciliacion: "Conciliado",
      pago_factura_id: "pf-1",
    });
    fireEvent.click(screen.getByRole("button", { name: /ver pago/i }));
    expect(onVerPago).toHaveBeenCalledWith({ tipo: "cobro", id: "pf-1" });
  });

  it("prioriza el lote sobre el pago individual", async () => {
    const onVerPago = renderBoton({
      estado_conciliacion: "Conciliado",
      pago_proveedor_id: "pp-1",
      pago_proveedor_lote_id: "lote-1",
    });
    fireEvent.click(screen.getByRole("button", { name: /ver pago/i }));
    expect(onVerPago).toHaveBeenCalledWith({ tipo: "lote", id: "lote-1" });
  });
});
