/**
 * CXP-NEW-11 — la fila y el KPI "Por vencer 7d" comparten el canon único de 7
 * días. Antes `clasificar()` usaba una ventana de 5 días: una factura a 6 o 7
 * días se veía "Vigente" en la tabla y "Por vencer" en la tarjeta.
 */
import { describe, it, expect } from "vitest";
import { clasificar } from "../proveedorFacturas.helpers";

const vigenteAprobada = (dias: number) =>
  clasificar(1000, 0, dias, "Aprobada", "aprobada");

describe("clasificar · ventana Por vencer de 7 días", () => {
  it("a -5 días es Por vencer", () => {
    expect(vigenteAprobada(-5)).toBe("Por vencer");
  });

  it("a -6 días es Por vencer (antes decía Vigente)", () => {
    expect(vigenteAprobada(-6)).toBe("Por vencer");
  });

  it("a -7 días es Por vencer (límite incluido)", () => {
    expect(vigenteAprobada(-7)).toBe("Por vencer");
  });

  it("a -8 días ya es Vigente", () => {
    expect(vigenteAprobada(-8)).toBe("Vigente");
  });

  it("vencida sigue teniendo prioridad", () => {
    expect(vigenteAprobada(1)).toBe("Vencida");
  });
});
