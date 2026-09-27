import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PagoImpactoPreview } from "../PagoImpactoPreview";
import { calcularImpactoPago } from "@/features/cxp/services/pagoImpactoPreview";
import { formatCurrency } from "@/lib/formatters";

const params = {
  factura: { moneda: "MXN", saldo: 885.5, pagado: 0, total: 885.5 },
  montoEnMonedaFactura: 300, monto: 300, monedaPago: "MXN", tcNum: null,
  bloqueadoPorTc: false, requiereCuenta: true,
  cuentaEtiqueta: "BBVA · Operativa (MXN)", proveedor: null,
};

describe("PagoImpactoPreview", () => {
  it("efectivo no anuncia débito ni cuenta bancaria", () => {
    render(<PagoImpactoPreview impacto={calcularImpactoPago({ ...params, requiereCuenta: false })} proveedorNombre="Maniobras Regias" />);
    expect(screen.getByText("Pago en efectivo")).toBeVisible();
    expect(screen.getByText("Sin movimiento bancario")).toBeVisible();
    expect(screen.queryByText("Salida de banco")).not.toBeInTheDocument();
    expect(screen.queryByText(/BBVA|Selecciona una cuenta/)).not.toBeInTheDocument();
    expect(screen.getByText(formatCurrency(300, "MXN"))).toBeVisible();
    expect(screen.getByText(formatCurrency(585.5, "MXN"))).toBeVisible();
  });
  it("transferencia mantiene cuenta y monto bancario", () => {
    render(<PagoImpactoPreview impacto={calcularImpactoPago(params)} proveedorNombre="Maniobras Regias" />);
    expect(screen.getByText("Salida de banco")).toBeVisible();
    expect(screen.getByText(params.cuentaEtiqueta)).toBeVisible();
    expect(screen.queryByText("Sin movimiento bancario")).not.toBeInTheDocument();
  });
  it("transferencia pendiente de cuenta pide seleccionarla y no dice efectivo", () => {
    render(<PagoImpactoPreview impacto={calcularImpactoPago({ ...params, cuentaEtiqueta: null })} proveedorNombre="Maniobras Regias" />);
    expect(screen.getByText("Selecciona una cuenta bancaria")).toBeVisible();
    expect(screen.queryByText("Pago en efectivo")).not.toBeInTheDocument();
  });
});
