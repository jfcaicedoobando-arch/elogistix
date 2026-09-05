/**
 * B4 (v13.823.151): al pasar a FCL, el primer contenedor hereda las cantidades
 * generales ya capturadas — sin duplicarlas ni dejarlas en cero.
 */
import { describe, it, expect } from "vitest";
import {
  contenedorSembradoDesdeGenerales,
  conservarGeneralesEnContenedores,
  requiereConservarGenerales,
} from "../semillaContenedor";
import { crearContenedorVacio } from "@/features/embarques/types/contenedor";

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

/**
 * B4 remate (v13.823.152): la conservación también debe actuar cuando YA existe
 * una fila (agregada antes de elegir FCL) o al reabrir un borrador con filas en
 * cero — sin pisar cantidades reales ni acumular al cambiar de servicio.
 */
describe("conservarGeneralesEnContenedores / requiereConservarGenerales", () => {
  const generales = { pesoKg: "12000", volumenM3: "35.5", piezas: "8" };

  it("pasa las cantidades a una fila ya capturada con número/tipo", () => {
    const filas = [
      { ...crearContenedorVacio(1), numero_contenedor: "ABCD1234567", tipo_contenedor: "40HC" },
    ];
    const next = conservarGeneralesEnContenedores(filas, generales);
    expect(next[0].numero_contenedor).toBe("ABCD1234567");
    expect(next[0].tipo_contenedor).toBe("40HC");
    expect(next[0].peso_kg).toBe(12000);
    expect(next[0].volumen_m3).toBe(35.5);
    expect(next[0].piezas).toBe(8);
  });

  it("siembra la primera fila cuando la lista está vacía", () => {
    expect(conservarGeneralesEnContenedores([], generales)).toHaveLength(1);
  });

  it("no acumula ni duplica al aplicarse dos veces", () => {
    const uno = conservarGeneralesEnContenedores([crearContenedorVacio(1)], generales);
    const dos = conservarGeneralesEnContenedores(uno, generales);
    expect(dos[0].peso_kg).toBe(12000);
    expect(dos).toEqual(uno);
  });

  it("respeta la corrección explícita a cero cuando otra fila tiene cantidades", () => {
    const filas = [
      { ...crearContenedorVacio(1), peso_kg: 0, volumen_m3: 0, piezas: 0 },
      { ...crearContenedorVacio(2), peso_kg: 5000, volumen_m3: 10, piezas: 2 },
    ];
    expect(requiereConservarGenerales(filas, generales)).toBe(false);
    expect(conservarGeneralesEnContenedores(filas, generales)).toBe(filas);
  });

  it("no pide conservar si no hay cantidades generales", () => {
    expect(requiereConservarGenerales([crearContenedorVacio(1)], { pesoKg: "", volumenM3: "", piezas: "" })).toBe(false);
  });

  it("pide conservar si todas las filas están en cero y hay generales", () => {
    expect(requiereConservarGenerales([crearContenedorVacio(1)], generales)).toBe(true);
  });
});
