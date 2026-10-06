import { describe, expect, it } from "vitest";
import { ESTADOS_NC_CON_CFDI } from "../notasCreditoZip.constants";

describe("credit note ZIP eligibility", () => {
  it("preserves exactly the existing CFDI states after extracting the constant", () => {
    expect([...ESTADOS_NC_CON_CFDI]).toEqual(["Timbrada", "Aplicada", "Cancelada"]);
    expect(ESTADOS_NC_CON_CFDI.has("Borrador")).toBe(false);
    expect(ESTADOS_NC_CON_CFDI.has("Aprobada")).toBe(false);
  });
});
