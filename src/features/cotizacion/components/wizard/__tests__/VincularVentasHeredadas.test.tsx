import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ConceptoVentaCotizacion, FilaCostoLocal } from "@/features/cotizacion/types";
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (value: string) => void }) => <select aria-label="Vínculo venta" value={value} onChange={e => onValueChange(e.target.value)}><option value="">Conservar</option>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
}));
import { VincularVentasHeredadas } from "../VincularVentasHeredadas";
const costo: FilaCostoLocal = { origen_venta_id: "cost-A", venta_vinculo_pendiente: true, concepto: "Flete", moneda: "USD", proveedor: "Naviera", cantidad: 1, costo_unitario: 1, precio_venta: 2, unidad_medida: "Servicio" };
const venta: ConceptoVentaCotizacion = { descripcion: "Flete", moneda: "USD", cantidad: 1, precio_unitario: 100, unidad_medida: "Servicio", aplica_iva: true, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 116 };
const manual: ConceptoVentaCotizacion = { ...venta, descripcion: "Manual MXN", moneda: "MXN", precio_unitario: 10200, total: 11832 };
describe("Audit145: revisión explícita del vínculo legado", () => {
  it("conserva estado al abrir/cancelar sin decidir y expone advertencia clara", () => {
    const onVincular = vi.fn();
    const { unmount } = render(<VincularVentasHeredadas costos={[costo]} ventas={[venta, manual]} tasaIva={0.16} onVincular={onVincular} />);
    expect(screen.getByText(/Conservamos tus conceptos e impuestos actuales/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar vínculo" })).toBeDisabled();
    unmount();
    expect(onVincular).not.toHaveBeenCalled();
  });
  it("seleccionar no modifica; aplicar actualiza sólo partida elegida con IVA y manual intactos", () => {
    const onVincular = vi.fn();
    render(<VincularVentasHeredadas costos={[costo]} ventas={[venta, manual]} tasaIva={0.16} onVincular={onVincular} />);
    fireEvent.change(screen.getByLabelText("Vínculo venta"), { target: { value: "0" } });
    expect(onVincular).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar vínculo" }));
    expect(onVincular).toHaveBeenCalledWith([expect.objectContaining({ venta_vinculo_pendiente: false })], [expect.objectContaining({ origen_costo_id: "cost-A", precio_unitario: 2, total: 2.32, tipo_iva: "gravado_16" }), manual]);
  });
  it("agregar nueva conserva todas las actuales sin presumir identidad", () => {
    const onVincular = vi.fn();
    render(<VincularVentasHeredadas costos={[costo]} ventas={[venta, manual]} tasaIva={0.16} onVincular={onVincular} />);
    fireEvent.change(screen.getByLabelText("Vínculo venta"), { target: { value: "nueva" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar vínculo" }));
    expect(onVincular.mock.calls[0][1]).toEqual([venta, manual, expect.objectContaining({ origen_costo_id: "cost-A", precio_unitario: 2 })]);
  });
  it("conserva la venta MXN elegida al agregar una USD y reagrupar las monedas", () => {
    const costoMXN = { ...costo, origen_venta_id: "cost-MXN", concepto: "Destino", moneda: "MXN" as const };
    const elegida = { ...manual, descripcion: "Venta MXN elegida" };
    const onVincular = vi.fn();
    const { rerender } = render(<VincularVentasHeredadas costos={[costo, costoMXN]} ventas={[venta, manual, elegida]} tasaIva={0.16} onVincular={onVincular} />);
    fireEvent.change(screen.getAllByLabelText("Vínculo venta")[1], { target: { value: "2" } });
    fireEvent.change(screen.getAllByLabelText("Vínculo venta")[0], { target: { value: "nueva" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Aplicar vínculo" })[0]);
    const [costos, ventas] = onVincular.mock.calls[0] as [FilaCostoLocal[], ConceptoVentaCotizacion[]];
    const reagrupadas = [...ventas.filter(v => v.moneda === "USD"), ...ventas.filter(v => v.moneda === "MXN")];
    expect(reagrupadas[2]).toBe(manual);
    rerender(<VincularVentasHeredadas costos={costos} ventas={reagrupadas} tasaIva={0.16} onVincular={onVincular} />);
    expect(screen.getByLabelText("Vínculo venta")).toHaveValue("3");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar vínculo" }));
    expect(onVincular).toHaveBeenCalledTimes(2);
    expect(onVincular.mock.calls[1][1]).toEqual([
      venta, reagrupadas[1], manual,
      expect.objectContaining({ descripcion: elegida.descripcion, origen_costo_id: "cost-MXN", precio_unitario: 2, total: 2.32 }),
    ]);
  });
  it("invalida la selección cuando otra venta reemplaza la fila elegida", () => {
    const onVincular = vi.fn();
    const { rerender } = render(<VincularVentasHeredadas costos={[costo]} ventas={[venta]} tasaIva={0.16} onVincular={onVincular} />);
    fireEvent.change(screen.getByLabelText("Vínculo venta"), { target: { value: "0" } });
    rerender(<VincularVentasHeredadas costos={[costo]} ventas={[{ ...venta, descripcion: "Otra venta" }]} tasaIva={0.16} onVincular={onVincular} />);
    expect(screen.getByLabelText("Vínculo venta")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Aplicar vínculo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar vínculo" }));
    expect(onVincular).not.toHaveBeenCalled();
  });
});
