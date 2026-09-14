import { describe, expect, it } from "vitest";
import { subtotalesVigentesFacturas } from "../historialFacturas.helpers";

describe("subtotales vigentes del historial", () => {
  it("separa MXN y USD sin convertirlos", () => {
    const subtotales = subtotalesVigentesFacturas([
      { total: 1000, moneda: "MXN", estado: "Emitida" },
      { total: 100, moneda: "USD", estado: "Emitida" },
    ]);
    expect(subtotales).toHaveLength(2);
    expect(subtotales[0]).toContain("1,000");
    expect(subtotales[1]).toContain("100");
  });

  it("excluye canceladas del subtotal vigente", () => {
    const subtotales = subtotalesVigentesFacturas([
      { total: 1000, moneda: "MXN", estado: "Emitida" },
      { total: 9000, moneda: "MXN", estado: "Cancelada" },
    ]);
    expect(subtotales).toHaveLength(1);
    expect(subtotales[0]).toContain("1,000");
    expect(subtotales[0]).not.toContain("10,000");
  });
});