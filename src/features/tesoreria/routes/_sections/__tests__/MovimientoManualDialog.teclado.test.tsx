import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MovimientoManualDialog } from "@/features/tesoreria/routes/_sections/MovimientoManualDialog";
import type { CuentaBancaria } from "@/features/tesoreria/services";

const cuentas = [
  { id: "c1", banco: "BBVA", alias: "Cheques", moneda: "USD" } as unknown as CuentaBancaria,
];

const formValido = {
  cuentaBancariaId: "c1",
  fecha: "2026-08-10",
  tipo: "cargo" as const,
  concepto: "Comisión",
  referencia: "",
  monto: 1500,
};

function renderDialog(overrides: Partial<Parameters<typeof MovimientoManualDialog>[0]> = {}) {
  const onGuardar = vi.fn();
  render(
    <MovimientoManualDialog
      open
      onOpenChange={() => {}}
      cuentas={cuentas}
      manualForm={formValido}
      setManualField={vi.fn()}
      onGuardar={onGuardar}
      isPending={false}
      {...overrides}
    />,
  );
  return { onGuardar };
}

describe("<MovimientoManualDialog /> teclado y dinero", () => {
  it("el importe usa el campo de dinero con la moneda de la cuenta", () => {
    renderDialog();
    const input = screen.getByLabelText("Importe *");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(input).toHaveValue("1,500");
    expect(screen.getByText("USD")).toBeInTheDocument();
  });

  it("Enter en un campo guarda cuando el formulario es válido", () => {
    const { onGuardar } = renderDialog();
    fireEvent.keyDown(screen.getByLabelText("Concepto *"), { key: "Enter" });
    expect(onGuardar).toHaveBeenCalledTimes(1);
  });

  it("Enter no guarda si el formulario es inválido", () => {
    const { onGuardar } = renderDialog({ manualForm: { ...formValido, monto: 0 } });
    fireEvent.keyDown(screen.getByLabelText("Concepto *"), { key: "Enter" });
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it("todas las etiquetas están asociadas a su control", () => {
    renderDialog();
    for (const label of ["Concepto *", "Referencia", "Importe *"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});
