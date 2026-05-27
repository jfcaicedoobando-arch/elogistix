import { describe, it, expect } from "vitest";
import {
  modoEmbarqueSchema,
  tipoOperacionSchema,
  incotermSchema,
  tipoServicioMaritimoSchema,
  monedaSchema,
} from "../embarquePayloadSchemas";

describe("embarquePayloadSchemas", () => {
  it("acepta enums válidos", () => {
    expect(modoEmbarqueSchema.parse("Marítimo")).toBe("Marítimo");
    expect(tipoOperacionSchema.parse("Importación")).toBe("Importación");
    expect(incotermSchema.parse("FOB")).toBe("FOB");
    expect(tipoServicioMaritimoSchema.parse("FCL")).toBe("FCL");
    expect(monedaSchema.parse("MXN")).toBe("MXN");
  });

  it("rechaza valores no enumerados", () => {
    expect(() => modoEmbarqueSchema.parse("Aerea")).toThrow();
    expect(() => incotermSchema.parse("BLAH")).toThrow();
    expect(() => monedaSchema.parse("ARS")).toThrow();
  });
});
