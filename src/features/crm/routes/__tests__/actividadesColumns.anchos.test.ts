/**
 * Regresión de medición: la tabla de Actividades CRM debe caber en el ancho
 * útil de un desktop HD 1280x720 (~950px de contenedor) sin scroll horizontal,
 * y la columna de acciones debe quedar fija a la derecha.
 */
import { describe, it, expect } from "vitest";
import { baseActividadColumns, actividadActionColumn } from "../actividadesColumns";

/** Ancho útil medido en producción para /crm/actividades en 1280x720. */
const ANCHO_UTIL_HD = 950;
/** Ancho mínimo razonable para la columna flexible "Asunto". */
const ASUNTO_MIN = 180;

const px = (width?: string): number => {
  if (!width) return 0;
  const m = /\[(\d+)px\]/.exec(width);
  return m ? Number(m[1]) : 0;
};

describe("actividadesColumns — medición 1280x720", () => {
  const columnas = [...baseActividadColumns, actividadActionColumn(() => true)];

  it("la suma de columnas fijas deja espacio para Asunto sin desbordar", () => {
    const fijas = columnas
      .filter((c) => c.id !== "asunto")
      .reduce((acc, c) => acc + px(c.meta?.width), 0);
    expect(fijas).toBeGreaterThan(0);
    expect(fijas + ASUNTO_MIN).toBeLessThanOrEqual(ANCHO_UTIL_HD);
  });

  it("Asunto es la única columna flexible", () => {
    const asunto = columnas.find((c) => c.id === "asunto");
    expect(asunto?.meta?.width).toBeUndefined();
  });

  it("la columna de acciones queda fija a la derecha", () => {
    const acciones = columnas.find((c) => c.id === "acciones");
    expect(acciones?.meta?.stickyRight).toBe(true);
  });
});
