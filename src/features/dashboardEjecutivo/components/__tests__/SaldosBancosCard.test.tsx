/**
 * Ola de exactitud financiera (v13.823.5): el footer muestra un total por cada
 * moneda realmente presente (MXN, USD, EUR), sin quedar fijo a MXN/USD.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SaldosBancosCard } from "../SaldosBancosCard";
import type { ResumenCuenta } from "@/features/tesoreria/services";

function cuenta(over: Partial<ResumenCuenta>): ResumenCuenta {
  return { id: "c1", alias: "Cuenta", banco: "BBVA", moneda: "MXN", saldo: 0, ...over } as ResumenCuenta;
}

describe("SaldosBancosCard", () => {
  it("muestra total por cada moneda presente, incluyendo EUR", () => {
    render(<SaldosBancosCard cuentas={[
      cuenta({ id: "1", moneda: "MXN", saldo: 1000 }),
      cuenta({ id: "2", moneda: "USD", saldo: 50 }),
      cuenta({ id: "3", moneda: "EUR", saldo: 25 }),
    ]} />);
    expect(screen.getByText("Total MXN")).toBeInTheDocument();
    expect(screen.getByText("Total USD")).toBeInTheDocument();
    expect(screen.getByText("Total EUR")).toBeInTheDocument();
  });

  it("no muestra total EUR cuando la organización no tiene cuentas EUR", () => {
    render(<SaldosBancosCard cuentas={[cuenta({ id: "1", moneda: "MXN", saldo: 500 })]} />);
    expect(screen.getByText("Total MXN")).toBeInTheDocument();
    expect(screen.queryByText("Total EUR")).toBeNull();
    expect(screen.queryByText("Total USD")).toBeNull();
  });

  it("suma varias cuentas de la misma moneda", () => {
    render(<SaldosBancosCard cuentas={[
      cuenta({ id: "1", moneda: "EUR", saldo: 25 }),
      cuenta({ id: "2", moneda: "EUR", saldo: 75 }),
    ]} />);
    expect(screen.getByText("Total EUR")).toBeInTheDocument();
    expect(screen.getAllByText(/100/).length).toBeGreaterThan(0);
  });
});
