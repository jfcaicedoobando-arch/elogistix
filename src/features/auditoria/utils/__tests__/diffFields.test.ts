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

describe("diffConceptos", () => {
  it("returns zero counts for identical lists", () => {
    const a = [{ concepto: "Flete", monto: 100, moneda: "USD", proveedor_id: "p1" }];
    const out = diffConceptos(a, a);
    expect(out.agregados).toBe(0);
    expect(out.eliminados).toBe(0);
    expect(out.modificados).toBe(0);
  });

  it("detects additions and removals", () => {
    const before = [{ concepto: "Flete", monto: 100, moneda: "USD", proveedor_id: "p1" }];
    const after = [{ concepto: "Maniobras", monto: 50, moneda: "MXN", proveedor_id: "p2" }];
    const out = diffConceptos(before, after);
    expect(out.agregados).toBe(1);
    expect(out.eliminados).toBe(1);
    expect(out.modificados).toBe(0);
  });

  it("detects amount modifications on matched concepts", () => {
    const before = [{ concepto: "Flete", monto: 100, moneda: "USD", proveedor_id: "p1" }];
    const after = [{ concepto: "Flete", monto: 150, moneda: "USD", proveedor_id: "p1" }];
    const out = diffConceptos(before, after);
    expect(out.modificados).toBe(1);
    expect(out.detalle[0]).toMatchObject({ tipo: "modificado", antes: "100.00 USD", despues: "150.00 USD" });
  });

  it("uses precio_unitario * cantidad when monto is absent", () => {
    const before = [{ descripcion: "Flete", cantidad: 2, precio_unitario: 50, moneda: "USD" }];
    const after = [{ descripcion: "Flete", cantidad: 3, precio_unitario: 50, moneda: "USD" }];
    const out = diffConceptos(before, after);
    expect(out.modificados).toBe(1);
    expect(out.detalle[0].despues).toBe("150.00 USD");
  });

  it("matches case-insensitively and trims concept name", () => {
    const before = [{ concepto: "  Flete ", monto: 100, moneda: "USD", proveedor_id: "p1" }];
    const after = [{ concepto: "flete", monto: 100, moneda: "USD", proveedor_id: "p1" }];
    const out = diffConceptos(before, after);
    expect(out.agregados + out.eliminados + out.modificados).toBe(0);
  });
});
