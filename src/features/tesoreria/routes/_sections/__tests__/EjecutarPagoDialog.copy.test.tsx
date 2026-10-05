import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EjecutarPagoDialog } from "../EjecutarPagoDialog";
import type { FacturaProgramable } from "../../../domain/pagosProgramados";

describe("Registrar pago: no ejecución de una transferencia", () => {
  it("explica el alcance ERP y reserva Método de pago para PUE/PPD", () => {
    const factura = { proveedor_nombre: "Fletes del Norte", saldo: 1000, moneda: "MXN" } as FacturaProgramable;
    const onEjecutar = vi.fn();
    render(<EjecutarPagoDialog facturaPago={factura} onClose={vi.fn()} cuentasCompatibles={[]} form={{ cuentaBancariaId: "", fecha: "2026-10-04", monto: 1000, metodoPago: "Transferencia", referencia: "" }} setField={vi.fn()} onEjecutar={onEjecutar} isPending={false} />);
    expect(screen.getByText(/El ERP no envía dinero al banco/)).toBeInTheDocument();
    expect(screen.getByLabelText("Medio de pago")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pago" })).toBeDisabled();
    expect(onEjecutar).not.toHaveBeenCalled();
  });
});
