/**
 * Regresión de medición: /crm/prospectos debe caber en desktop HD 1280x720
 * (~950px de contenedor útil) sin scroll horizontal, conservando la columna
 * "Alta" visible. Sector y Rutas se muestran sólo desde 2xl.
 */
import { describe, it, expect } from "vitest";
import { prospectosColumns } from "../prospectosColumns";

const ANCHO_UTIL_HD = 950;
const EMPRESA_MIN = 200;

const px = (width?: string): number => {
  const m = width ? /\[(\d+)px\]/.exec(width) : null;
  return m ? Number(m[1]) : 0;
};

const visibleEnHd = (cls?: string) => !(cls ?? "").includes("hidden 2xl:table-cell");

describe("prospectosColumns — medición 1280x720", () => {
  it("las columnas visibles en HD caben con espacio para Empresa", () => {
    const fijas = prospectosColumns
      .filter((c) => c.id !== "empresa" && visibleEnHd(c.meta?.className))
      .reduce((acc, c) => acc + px(c.meta?.width), 0);
    expect(fijas).toBeGreaterThan(0);
    expect(fijas + EMPRESA_MIN).toBeLessThanOrEqual(ANCHO_UTIL_HD);
  });

  it("Empresa es la columna flexible y queda fija a la izquierda", () => {
    const empresa = prospectosColumns.find((c) => c.id === "empresa");
    expect(empresa?.meta?.width).toBeUndefined();
    expect(empresa?.meta?.sticky).toBe(true);
  });

  it("Alta sigue visible en HD", () => {
    const alta = prospectosColumns.find((c) => c.id === "created_at");
    expect(visibleEnHd(alta?.meta?.className)).toBe(true);
  });
});
