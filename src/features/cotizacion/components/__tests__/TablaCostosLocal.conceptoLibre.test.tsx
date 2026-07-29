import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TablaCostosLocal from "../TablaCostosLocal";
import { esFilaCostoValida } from "../costosPLTypes";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

vi.mock("@/features/cotizacion/hooks/useProductosCatalogo", () => ({
  useProductosCatalogo: () => ({ productos: [], isLoading: false, porNombre: new Map() }),
  tasaDesdeTipoIva: () => 0.16,
}));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ organizationId: "org-1" }) }));

describe("TablaCostosLocal — concepto libre (Q-12)", () => {
  it("una fila con concepto_libre=true y sin clave_sat es válida", () => {
    const fila: FilaCostoLocal = {
      concepto: "Servicio especial no catalogado",
      moneda: "USD",
      proveedor: "",
      cantidad: 1,
      costo_unitario: 100,
      precio_venta: 150,
      unidad_medida: "E48",
      clave_sat: "",
      concepto_libre: true,
    };
    expect(esFilaCostoValida(fila)).toBe(true);
  });

  it("muestra el aviso de concepto libre en la fila renderizada", () => {
    const fila: FilaCostoLocal = {
      concepto: "Servicio especial no catalogado",
      moneda: "USD",
      proveedor: "",
      cantidad: 1,
      costo_unitario: 100,
      precio_venta: 150,
      unidad_medida: "E48",
      clave_sat: "",
      concepto_libre: true,
    };
    render(
      <TablaCostosLocal
        filas={[fila]}
        filasMoneda={[fila]}
        moneda="USD"
        title="Costos USD"
        icon={<span />}
        totales={{ totalCosto: 100, totalVenta: 150, profit: 50, porcentaje: 33 }}
        onUpdate={() => {}}
        onAdd={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByTestId("concepto-libre-aviso-0")).toHaveTextContent("Concepto libre");
  });
});
