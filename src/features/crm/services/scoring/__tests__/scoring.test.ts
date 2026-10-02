import { describe, it, expect } from "vitest";
import { parsePuntajeDetalle } from "../scoringCrm";
import { validarCortes, validarRegla } from "../reglasScoringCrm";
import { describirCondicion } from "@/features/crm/components/scoring/ReglaScoringFila";
import type { ReglaScoring } from "../reglasScoringCrm";

const base: ReglaScoring = {
  id: "r", objeto: "empresa", criterio: "Volumen", fuente: "propiedad", propiedad_id: "p",
  opcion_id: null, valor_texto: null, min: null, max: null, puntos: 10, orden: 1, activa: true,
};

describe("puntaje", () => {
  it("normaliza el detalle de la base", () => {
    expect(parsePuntajeDetalle({ puntaje: 65, letra: "B", desglose: [{ criterio: "Etapa", puntos: 15, maximo: 25 }], cerrada: false }))
      .toEqual({ puntaje: 65, letra: "B", cerrada: false, desglose: [{ criterio: "Etapa", puntos: 15, maximo: 25 }] });
    expect(parsePuntajeDetalle({ puntaje: null, letra: null, cerrada: true })?.letra).toBeNull();
    expect(parsePuntajeDetalle(null)).toBeNull();
    expect(parsePuntajeDetalle({ letra: "Z" })?.letra).toBeNull();
  });
  it("valida cortes", () => {
    expect(validarCortes(80, 50)).toBeNull();
    expect(validarCortes(50, 50)).toMatch(/menor/);
    expect(validarCortes(120, 50)).toMatch(/0 a 100/);
  });
  it("valida reglas", () => {
    expect(validarRegla(base)).toBeNull();
    expect(validarRegla({ ...base, criterio: " " })).toMatch(/criterio/);
    expect(validarRegla({ ...base, propiedad_id: null })).toMatch(/propiedad/);
    expect(validarRegla({ ...base, min: 10, max: 5 })).toMatch(/mínimo/);
    expect(validarRegla({ ...base, puntos: 101 })).toMatch(/0 a 100/);
    expect(validarRegla({ ...base, fuente: "etapa", propiedad_id: null, valor_texto: "" })).toMatch(/etapa/);
  });
  it("describe la condición en español", () => {
    expect(describirCondicion({ ...base, min: 250000, max: 1000000 })).toBe("250,000 a menos de 1,000,000");
    expect(describirCondicion({ ...base, min: 10 })).toBe("10 o más");
    expect(describirCondicion(base)).toBe("Capturado");
    expect(describirCondicion({ ...base, opcion_id: "o" }, "Marítimo")).toBe("Opción: Marítimo");
    expect(describirCondicion({ ...base, fuente: "etapa", valor_texto: "Calificado" })).toBe("Etapa = Calificado");
  });
});
