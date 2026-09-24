import { describe, expect, it } from "vitest";
import { resumenCargaLcl } from "@/lib/domain/resumenCargaLcl";
import { calcularFleteLcl } from "@/features/embarques/components/OrigenLclManualCard";

describe("LCL (#8/#9)", () => {
  it("resume piezas, kg y m³", () => {
    expect(resumenCargaLcl([{ piezas: 3, volumen_m3: 2.5 }, { piezas: 1, volumen_m3: 1.34 }], 950))
      .toBe("4 piezas, 950 kg, 3.84 m³");
  });
  it("flete W/M respeta el mínimo", () => {
    expect(calcularFleteLcl(145, 400, 3.84, 950).costo).toBeCloseTo(556.8);
    expect(calcularFleteLcl(145, 400, 1, 100).costo).toBe(400);
  });
});
