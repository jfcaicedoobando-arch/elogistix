import { describe, it, expect } from "vitest";
import * as index from "../index";

describe("presupuesto index", () => {
  it("exporta funciones de categorias", () => {
    expect(index.fetchCategorias).toBeDefined();
  });
  it("exporta funciones de mensual", () => {
    expect(index.fetchPresupuestoMensualAnio).toBeDefined();
  });
  it("exporta funciones de vsReal", () => {
    expect(index.fetchPresupuestoVsReal).toBeDefined();
  });
});
