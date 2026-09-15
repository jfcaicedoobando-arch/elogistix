/**
 * EMB-NEW-02 — un embarque activo nunca se etiqueta como "Borrador <id>".
 */
import { describe, it, expect } from "vitest";
import { labelExpediente } from "../labelExpediente";

const ID = "d0d9a0dd-e5b1-47a7-91b1-8ac2f4318fc5";

describe("labelExpediente", () => {
  it("devuelve el expediente cuando existe", () => {
    expect(labelExpediente("ELIMP00405", ID, "En Tránsito")).toBe("ELIMP00405");
  });

  it("estado Borrador sin folio: etiqueta de borrador", () => {
    expect(labelExpediente(null, ID, "Borrador")).toBe("Borrador d0d9a0dd");
  });

  it("estado activo sin folio: NUNCA dice Borrador", () => {
    const label = labelExpediente(null, ID, "En Tránsito");
    expect(label).not.toMatch(/borrador/i);
    expect(label).toBe("Sin folio (d0d9a0dd)");
  });

  it("sin estado conocido conserva el comportamiento anterior", () => {
    expect(labelExpediente("  ", ID)).toBe("Borrador d0d9a0dd");
    expect(labelExpediente(null)).toBe("Sin folio");
  });
});
