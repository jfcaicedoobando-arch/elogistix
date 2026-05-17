import { describe, it, expect } from "vitest";
import { diffFields, diffConceptos } from "../diffFields";

describe("diffFields", () => {
  it("returns empty when before is null", () => {
    expect(diffFields(null, { nombre: "X" })).toEqual([]);
  });

  it("ignores unchanged fields", () => {
    expect(diffFields({ nombre: "A" }, { nombre: "A" })).toEqual([]);
  });

  it("treats null, undefined and empty string as equivalent", () => {
    expect(diffFields({ rfc: "" } as Record<string, unknown>, { rfc: null })).toEqual([]);
    expect(diffFields({ rfc: undefined } as Record<string, unknown>, { rfc: "" })).toEqual([]);
  });

  it("captures real changes", () => {
    const out = diffFields(
      { nombre: "A", rfc: "X" },
      { nombre: "B", rfc: "X" },
    );
    expect(out).toEqual([{ campo: "nombre", antes: "A", despues: "B" }]);
  });

  it("respects fields whitelist", () => {
    const out = diffFields(
      { nombre: "A", updated_at: "old" },
      { nombre: "B", updated_at: "new" },
      ["nombre"],
    );
    expect(out).toHaveLength(1);
    expect(out[0].campo).toBe("nombre");
  });

  it("trims strings before comparing", () => {
    expect(diffFields({ nombre: "  Acme  " }, { nombre: "Acme" })).toEqual([]);
  });

  it("supports numeric and boolean changes", () => {
    const out = diffFields(
      { dias_credito: 30, activo: false },
      { dias_credito: 45, activo: true },
    );
    expect(out).toEqual([
      { campo: "dias_credito", antes: 30, despues: 45 },
      { campo: "activo", antes: false, despues: true },
    ]);
  });
});
