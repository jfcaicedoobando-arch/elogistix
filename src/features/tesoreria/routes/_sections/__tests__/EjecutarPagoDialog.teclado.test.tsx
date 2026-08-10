import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EjecutarPagoDialog, type FormPago } from "@/features/tesoreria/routes/_sections/EjecutarPagoDialog";
import type { FacturaProgramable } from "@/features/tesoreria/domain/pagosProgramados";
import type { CuentaBancaria } from "@/features/tesoreria/services";

const factura = {
  factura_id: "f1",
  proveedor_nombre: "Naviera SA",
  saldo: 5000,
  moneda: "USD",
} as unknown as FacturaProgramable;

const cuentas = [
  { id: "c1", banco: "BBVA", alias: "Dólares", moneda: "USD" } as unknown as CuentaBancaria,
];

const form: FormPago = {
  cuentaBancariaId: "c1",
  fecha: "2026-08-10",
  monto: 2500.5,
  metodoPago: "Transferencia",
  referencia: "",
};

function renderDialog(overrides: Partial<FormPago> = {}) {
  const onEjecutar = vi.fn();
  render(
    <EjecutarPagoDialog
      facturaPago={factura}
      onClose={() => {}}
      cuentasCompatibles={cuentas}
      form={{ ...form, ...overrides }}
      setField={vi.fn()}
      onEjecutar={onEjecutar}
      isPending={false}
    />,
  );
  return { onEjecutar };
}

describe("<EjecutarPagoDialog /> teclado y dinero", () => {
  it("el monto se muestra formateado con la moneda de la factura", () => {
    renderDialog();
    const input = screen.getByLabelText("Monto *");
    expect(input).toHaveValue("2,500.5");
    expect(input).toHaveAttribute("inputmode", "decimal");
  });

  it("se puede vaciar el monto sin que reaparezca el 0", () => {
    renderDialog();
    const input = screen.getByLabelText("Monto *");
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
  });

  it("Enter ejecuta el pago cuando los datos están completos", () => {
    const { onEjecutar } = renderDialog();
    fireEvent.keyDown(screen.getByLabelText("Referencia"), { key: "Enter" });
    expect(onEjecutar).toHaveBeenCalledTimes(1);
  });

  it("Enter no ejecuta el pago si el monto es cero", () => {
    const { onEjecutar } = renderDialog({ monto: 0 });
    fireEvent.keyDown(screen.getByLabelText("Referencia"), { key: "Enter" });
    expect(onEjecutar).not.toHaveBeenCalled();
  });
});
