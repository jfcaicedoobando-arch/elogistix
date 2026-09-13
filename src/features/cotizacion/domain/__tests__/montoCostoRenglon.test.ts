/**
 * v13.823.357 (Auditoría YAGNI P2 #8): el monto que llega al embarque es el
 * TOTAL del renglón, no el costo unitario.
 */
import { describe, it, expect } from "vitest";
import { montoCostoRenglon, mapCostosACostosEmbarque } from "../cotizacion.conversion";

describe("montoCostoRenglon", () => {
  it("usa costo_total cuando existe", () => {
    expect(montoCostoRenglon({ concepto: "Flete", costo_unitario: 100, cantidad: 3, costo_total: 305, moneda: "USD" }))
      .toBe(305);
  });

  it("multiplica cantidad x unitario cuando no hay costo_total", () => {
    expect(montoCostoRenglon({ concepto: "THC", costo_unitario: 100, cantidad: 3, moneda: "USD" })).toBe(300);
  });

  it("cantidad ausente se toma como 1 en el monto del renglón", () => {
    expect(montoCostoRenglon({ concepto: "B/L", costo_unitario: 50, moneda: "MXN" })).toBe(50);
  });

  it("cantidad 0 o negativa no anula el renglón (se trata como 1)", () => {
    expect(montoCostoRenglon({ concepto: "X", costo_unitario: 40, cantidad: 0, moneda: "MXN" })).toBe(40);
  });

  it("mapCostosACostosEmbarque replica el total en multi-cantidad", () => {
    const out = mapCostosACostosEmbarque(
      [{ concepto: "Flete", costo_unitario: 250, cantidad: 4, moneda: "USD", proveedor: "Naviera" }],
      "emb-9",
    );
    expect(out[0]).toEqual({
      embarque_id: "emb-9",
      concepto: "Flete",
      monto: 1000,
      moneda: "USD",
      proveedor_nombre: "Naviera",
    });
  });
});
