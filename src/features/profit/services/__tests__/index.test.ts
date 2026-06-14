import { describe, it, expect } from "vitest";
import * as index from "../index";

describe("profit index", () => {
  it("exporta funciones de estadoResultados", () => {
    expect(index.fetchEstadoResultadosMes).toBeDefined();
  });
  it("exporta funciones de estadoResultadosDevengado", () => {
    expect(index.fetchEstadoResultadosDevengado).toBeDefined();
  });
});
