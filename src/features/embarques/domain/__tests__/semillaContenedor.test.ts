/**
 * B4 (v13.823.151): al pasar a FCL, el primer contenedor hereda las cantidades
 * generales ya capturadas — sin duplicarlas ni dejarlas en cero.
 */
import { describe, it, expect } from "vitest";
import { contenedorSembradoDesdeGenerales } from "../semillaContenedor";

describe("contenedorSembradoDesdeGenerales", () => {
  it("copia peso, volumen y piezas capturados en Datos generales", () => {
    const c = contenedorSembradoDesdeGenerales({ pesoKg: "12000", volumenM3: "35.5", piezas: "8" });
    expect(c.peso_kg).toBe(12000);
    expect(c.volumen_m3).toBe(35.5);
    expect(c.piezas).toBe(8);
    expect(c.orden).toBe(1);
    expect(c.numero_contenedor).toBe("");
  });

  it("deja la fila en ceros cuando no hay cantidades capturadas", () => {
    const c = contenedorSembradoDesdeGenerales({ pesoKg: "", volumenM3: null, piezas: undefined }, 2);
    expect(c.peso_kg).toBe(0);
    expect(c.volumen_m3).toBe(0);
    expect(c.piezas).toBe(0);
    expect(c.orden).toBe(2);
  });

  it("ignora valores negativos o no numéricos", () => {
    const c = contenedorSembradoDesdeGenerales({ pesoKg: "-5", volumenM3: "abc", piezas: 3 });
    expect(c.peso_kg).toBe(0);
    expect(c.volumen_m3).toBe(0);
    expect(c.piezas).toBe(3);
  });
});
