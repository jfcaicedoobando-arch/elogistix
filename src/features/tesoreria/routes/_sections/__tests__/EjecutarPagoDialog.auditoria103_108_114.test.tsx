import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EjecutarPagoDialog, type FormPago } from "../EjecutarPagoDialog";
import type { FacturaProgramable } from "../../../domain/pagosProgramados";

const factura: FacturaProgramable = { id: "f", proveedor_nombre: "Proveedor", folio_proveedor: "FP18",
  fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-05", fecha_programada_pago: "2026-10-05",
  moneda: "USD", total: 16, saldo: 16, estado_aprobacion: "aprobada", tipo_cambio_usd: 18.1903 };
const base: FormPago = { cuentaBancariaId: "", fecha: "2026-10-05", monto: 1, metodoPago: "Efectivo", referencia: "", tipoCambio: 18.1903 };
function setup(overrides: Partial<FormPago> = {}, pending = false) {
  const onEjecutar = vi.fn();
  function Harness() {
    const [form, setForm] = useState({ ...base, ...overrides });
    return <EjecutarPagoDialog facturaPago={factura} form={form}
      setField={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
      cuentasCompatibles={[]} onClose={vi.fn()} onEjecutar={onEjecutar} isPending={pending} />;
  }
  render(<Harness />);
  return onEjecutar;
}
describe("AUD103/108/114 dialog preflight", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T18:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("efectivo sin banco muestra valuación y permite registrar", () => {
    const ejecutar = setup();
    expect(screen.queryByLabelText("Cuenta bancaria *")).not.toBeInTheDocument();
    expect(screen.getByText(/sin cuenta ni movimiento bancario/)).toBeInTheDocument();
    expect(screen.getByText(/Equivalente:/)).toHaveTextContent("18.19");
    expect(screen.getByRole("button", { name: "Registrar pago" })).toBeEnabled();
    fireEvent.submit(screen.getByLabelText("Referencia").closest("form")!);
    expect(ejecutar).toHaveBeenCalledOnce();
  });
  it("editar TC recalcula el equivalente y borrar TC bloquea envío incluso con Enter", () => {
    const ejecutar = setup();
    fireEvent.change(screen.getByLabelText("Tipo de cambio (MXN por USD) *"), { target: { value: "20" } });
    expect(screen.getByText(/Equivalente:/)).toHaveTextContent("20.00");
    fireEvent.change(screen.getByLabelText("Tipo de cambio (MXN por USD) *"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Registrar pago" })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Referencia").closest("form")!);
    expect(ejecutar).not.toHaveBeenCalled();
  });
  it("muestra exceso de saldo y fecha futura antes del envío", () => {
    const ejecutar = setup({ monto: 17, fecha: "2026-10-06" });
    expect(screen.getByText(/excede el saldo pendiente/)).toBeInTheDocument();
    expect(screen.getByText(/no puede tener fecha futura/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pago" })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Referencia").closest("form")!);
    expect(ejecutar).not.toHaveBeenCalled();
  });
  it("transferencia sin cuenta y submit pendiente no permiten registrar", () => {
    const ejecutar = setup({ metodoPago: "Transferencia" }, true);
    expect(screen.getByLabelText("Cuenta bancaria *")).toBeInTheDocument();
    fireEvent.submit(screen.getByLabelText("Referencia").closest("form")!);
    expect(ejecutar).not.toHaveBeenCalled();
  });
});
