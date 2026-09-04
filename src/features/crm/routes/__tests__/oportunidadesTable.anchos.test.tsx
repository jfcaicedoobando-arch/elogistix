/**
 * Regresión de medición: /crm/oportunidades (pestaña Tabla) debe caber en
 * desktop HD 1280x720 (~950px de contenedor útil) conservando visible la
 * columna "Siguiente actividad". Prob y Vendedor aparecen sólo desde 2xl.
 */
import { describe, it, expect } from "vitest";
import { oportunidadesColumns, siguienteActividadColumn } from "../oportunidadesTable";

const ANCHO_UTIL_HD = 950;
const NOMBRE_MIN = 200;

const px = (width?: string): number => {
  const m = width ? /\[(\d+)px\]/.exec(width) : null;
  return m ? Number(m[1]) : 0;
};

const visibleEnHd = (cls?: string) => !(cls ?? "").includes("hidden 2xl:table-cell");

describe("oportunidadesTable — medición 1280x720", () => {
  const columnas = [...oportunidadesColumns, siguienteActividadColumn(new Map())];

  it("las columnas visibles en HD caben con espacio para Oportunidad", () => {
    const fijas = columnas
      .filter((c) => c.id !== "nombre" && visibleEnHd(c.meta?.className))
      .reduce((acc, c) => acc + px(c.meta?.width), 0);
    expect(fijas).toBeGreaterThan(0);
    expect(fijas + NOMBRE_MIN).toBeLessThanOrEqual(ANCHO_UTIL_HD);
  });

  it("Oportunidad es la columna flexible y queda fija a la izquierda", () => {
    const nombre = columnas.find((c) => c.id === "nombre");
    expect(nombre?.meta?.width).toBeUndefined();
    expect(nombre?.meta?.sticky).toBe(true);
  });

  it("Siguiente actividad sigue visible en HD", () => {
    const sig = columnas.find((c) => c.id === "siguiente_actividad");
    expect(visibleEnHd(sig?.meta?.className)).toBe(true);
  });

  it("Prob y Vendedor se reservan para pantallas 2xl", () => {
    for (const id of ["prob", "vendedor"]) {
      const col = columnas.find((c) => c.id === id);
      expect(col?.meta?.className).toContain("hidden 2xl:table-cell");
      expect(col?.meta?.headerClassName).toContain("hidden 2xl:table-cell");
    }
  });
});
