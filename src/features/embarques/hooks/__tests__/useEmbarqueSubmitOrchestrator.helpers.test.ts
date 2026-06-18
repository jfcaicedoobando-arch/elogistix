import { describe, it, expect } from "vitest";
import { deriveContenedoresPayload } from "../useEmbarqueSubmitOrchestrator.helpers";

describe("deriveContenedoresPayload — LCL marítimo usa totales del form", () => {
  it("LCL marítimo: usa pesoKg/volumenM3/piezas del form", () => {
    const out = deriveContenedoresPayload({
      modo: "Marítimo",
      tipoServicio: "LCL",
      pesoKg: 451.83,
      volumenM3: 2.2,
      piezas: 5,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      tipo_contenedor: "LCL",
      peso_kg: 451.83,
      volumen_m3: 2.2,
      piezas: 5,
    });
  });

  it("LCL marítimo sin valores: defaults 0 (no rompe)", () => {
    const out = deriveContenedoresPayload({ modo: "Marítimo", tipoServicio: "LCL" });
    expect(out[0]).toMatchObject({ peso_kg: 0, volumen_m3: 0, piezas: 0 });
  });

  it("FCL marítimo: devuelve contenedores del form", () => {
    const out = deriveContenedoresPayload({
      modo: "Marítimo",
      tipoServicio: "FCL",
      contenedores: [{ numero_contenedor: "ABC", tipo_contenedor: "40HC", bl_house: "", peso_kg: 100, volumen_m3: 50, piezas: 10, orden: 1 }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].tipo_contenedor).toBe("40HC");
  });

  it("No marítimo: devuelve vacío", () => {
    expect(deriveContenedoresPayload({ modo: "Aéreo", tipoServicio: "LCL", pesoKg: 100 })).toEqual([]);
  });
});
