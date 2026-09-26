import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { formatCurrency } from "@/lib/formatters";
import { FilaCostoPrecio } from "../FilaCostoPrecio";
import { FilaVentaPrecio } from "../FilaVentaPrecio";

vi.mock("@/features/embarques/components/conceptos/ConceptoCatalogoSelect", () => ({
  ConceptoCatalogoSelect: ({ value, disabled }: { value: string; disabled: boolean }) =>
    <button disabled={disabled}>{value}</button>,
}));

describe("filas de pricing — etiquetas y bloqueos", () => {
  it("el costo conserva proveedor, concepto, subtotal y total calculado", () => {
    const update = vi.fn();
    render(<FilaCostoPrecio costo={{ id: 1, proveedorId: "p1", concepto: "Flete marítimo", monto: 4200, moneda: "USD" }}
      proveedoresDb={[{ id: "p1", nombre: "TS Lines México" }]} totalUSD={4200} esMixta={false}
      cols="lg:grid-cols-6" showContenedorCol={false} tcUSD={17} tcEUR={19}
      disableRemove={false} update={update} remove={vi.fn()} />);
    for (const label of ["Proveedor", "Concepto", "Subtotal (sin IVA)", "Moneda", "Total USD"]) {
      expect(screen.getByRole("group", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Total en USD del costo")).toHaveValue(formatCurrency(4200, "USD"));
    expect(update).not.toHaveBeenCalled();
  });

  it("un costo pagado sigue sin poder editarse ni eliminarse", () => {
    render(<FilaCostoPrecio costo={{ id: 1, proveedorId: "p1", concepto: "Flete marítimo", monto: 4200, moneda: "USD", estadoLiquidacion: "Pagado" }}
      proveedoresDb={[{ id: "p1", nombre: "TS Lines México" }]} totalUSD={4200} esMixta={false}
      cols="lg:grid-cols-6" showContenedorCol={false} tcUSD={17} tcEUR={19}
      disableRemove={false} update={vi.fn()} remove={vi.fn()} />);
    expect(screen.getByLabelText("Subtotal costo")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Eliminar costo directo" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Moneda del costo" })).toBeDisabled();
  });

  it("la venta conserva IVA explícito, cantidad, precio y bloqueo fiscal", () => {
    render(<FilaVentaPrecio venta={{ id: 2, concepto: "Gestión logística", cantidad: 2, precioUnitario: 3600,
      moneda: "MXN", aplicaIva: false, tasaIva: 0, tipoIva: "no_objeto", estadoFacturacion: "facturado" }}
      totalUSD={400} esMixta={false} cols="lg:grid-cols-6" showContenedorCol={false}
      tcUSD={18} disableRemove={false} update={vi.fn()} remove={vi.fn()} />);
    const fiscal = screen.getByRole("group", { name: "Concepto y tratamiento de IVA" });
    expect(within(fiscal).getByRole("combobox", { name: "Tratamiento de IVA" })).toBeDisabled();
    expect(within(fiscal).getByText("IVA: No objeto")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad venta")).toHaveValue("2");
    expect(screen.getByLabelText("Precio unitario venta (sin IVA)")).toBeDisabled();
    expect(screen.getByLabelText("Total en USD de la venta (cantidad × precio unitario)")).toHaveValue(formatCurrency(400, "USD"));
    expect(screen.getByRole("button", { name: "Eliminar concepto de venta" })).toBeDisabled();
  });
});
