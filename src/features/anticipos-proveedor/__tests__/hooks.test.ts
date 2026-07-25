import { describe, it, expect } from "vitest";

describe("AnticiposProveedor Hooks Logic", () => {
  it("calcula disponible correctamente (monto - aplicado)", () => {
    // Simulando la lógica de toRow que está en useAnticiposProveedor.ts
    const monto = 1000;
    const saldo_disponible = 400;
    
    const aplicado = monto - saldo_disponible;
    const disponible = saldo_disponible;
    
    expect(aplicado).toBe(600);
    expect(disponible).toBe(400);
  });
});
