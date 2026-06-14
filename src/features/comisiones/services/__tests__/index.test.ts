import { describe, it, expect } from "vitest";
import * as index from "../index";

describe("comisiones index", () => {
  it("exporta funciones de devengadas", () => {
    expect(index.fetchComisionesDevengadas).toBeDefined();
  });
  it("exporta funciones de liquidaciones", () => {
    expect(index.generarLiquidacion).toBeDefined();
  });
  it("exporta funciones de vendedoras", () => {
    expect(index.fetchVendedorasConfig).toBeDefined();
  });
});
