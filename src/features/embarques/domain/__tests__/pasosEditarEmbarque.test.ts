/**
 * B1 (v13.823.395): el paso 3 «Costos y Pricing» no existe para los roles que
 * sólo LEEN costos, y `?step=3` cae al paso 1.
 */
import { describe, it, expect } from "vitest";
import {
  pasosEditarEmbarque,
  resolverPasoEditarEmbarque,
} from "../pasosEditarEmbarque";

describe("pasosEditarEmbarque", () => {
  it("incluye Costos y Pricing cuando el rol puede editar costos", () => {
    const pasos = pasosEditarEmbarque(true);
    expect(pasos.map(p => p.num)).toEqual([1, 2, 3]);
    expect(pasos[2].title).toBe("Costos y Pricing");
  });

  it("omite Costos y Pricing para roles de sólo lectura de costos", () => {
    const pasos = pasosEditarEmbarque(false);
    expect(pasos.map(p => p.num)).toEqual([1, 2]);
    expect(pasos.some(p => p.title === "Costos y Pricing")).toBe(false);
  });
});

describe("resolverPasoEditarEmbarque", () => {
  it("respeta ?step=3 cuando el rol puede editar costos", () => {
    expect(resolverPasoEditarEmbarque("3", 3)).toBe(3);
  });

  it("manda ?step=3 al paso 1 cuando el rol no puede editar costos", () => {
    expect(resolverPasoEditarEmbarque("3", 2)).toBe(1);
  });

  it("conserva los pasos 1 y 2 editables", () => {
    expect(resolverPasoEditarEmbarque("1", 2)).toBe(1);
    expect(resolverPasoEditarEmbarque("2", 2)).toBe(2);
  });

  it("ignora valores inválidos", () => {
    expect(resolverPasoEditarEmbarque(null, 2)).toBeNull();
    expect(resolverPasoEditarEmbarque("abc", 2)).toBeNull();
    expect(resolverPasoEditarEmbarque("0", 2)).toBeNull();
  });
});
