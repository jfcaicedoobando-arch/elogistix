import { describe, expect, it } from "vitest";
import { buildEmbarquesDescription, expedienteConsecutivo } from "../embarquesPageHelpers";

describe("listado de embarques", () => {
  it("extrae el consecutivo del expediente para la tabla", () => {
    expect(expedienteConsecutivo("ELNAC-002")).toBe(2);
    expect(expedienteConsecutivo(null)).toBe(0);
  });

  it("con filtro de estado muestra expedientes", () => {
    expect(buildEmbarquesDescription(1, true)).toBe("1 expediente");
    expect(buildEmbarquesDescription(4, true)).toBe("4 expedientes");
  });

  it("sin filtro de estado muestra embarques", () => {
    expect(buildEmbarquesDescription(1, false)).toBe("1 embarque");
    expect(buildEmbarquesDescription(7, false)).toBe("7 embarques");
  });
});
