import { describe, it, expect } from "vitest";
import {
  diffFields,
  diffConceptos,
  SENSITIVE_FIELDS,
  type FieldDiff,
  type ConceptoLike,
} from "@/features/auditoria/utils/diffFields";

describe("diffFields.extra", () => {
  // ── diffFields ─────────────────────────────────────────────────────────────
  it("diffFields: retorna vacío cuando before es null", () => {
    expect(diffFields(null, { nombre: "Juan" })).toEqual([]);
  });

  it("diffFields: retorna vacío cuando before es undefined", () => {
    expect(diffFields(undefined, { nombre: "Ana" })).toEqual([]);
  });

  it("diffFields: detecta cambio simple de string", () => {
    const r = diffFields({ nombre: "Juan" }, { nombre: "Pedro" });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject<FieldDiff>({ campo: "nombre", antes: "Juan", despues: "Pedro" });
  });

  it("diffFields: null y cadena vacía se tratan como iguales (no difieren)", () => {
    const r = diffFields<{ rfc: string | null }>({ rfc: null }, { rfc: "" });
    expect(r).toHaveLength(0);
  });

  it("diffFields: undefined en before equivale a null", () => {
    const r = diffFields<{ email: string | null }>({ email: undefined }, { email: null });
    expect(r).toHaveLength(0);
  });

  it("diffFields: string con espacios se normaliza", () => {
    const r = diffFields({ ciudad: "  CDMX  " }, { ciudad: "CDMX" });
    expect(r).toHaveLength(0);
  });

  it("diffFields: boolean false != null sí es un cambio", () => {
    const r = diffFields<{ activo: boolean | null }>({ activo: null }, { activo: false });
    expect(r).toHaveLength(1);
    expect(r[0].despues).toBe(false);
  });

  it("diffFields: campo con b=undefined se ignora (no intentado actualizar)", () => {
    const r = diffFields({ nombre: "A" }, { nombre: undefined });
    expect(r).toHaveLength(0);
  });

  it("diffFields: solo compara los campos explícitos en `fields`", () => {
    const r = diffFields(
      { nombre: "A", rfc: "OLD" },
      { nombre: "B", rfc: "NEW" },
      ["nombre"],
    );
    expect(r).toHaveLength(1);
    expect(r[0].campo).toBe("nombre");
  });

  it("diffFields: objeto anidado se serializa para comparar", () => {
    const r = diffFields(
      { meta: { a: 1 } },
      { meta: { a: 2 } },
    );
    expect(r).toHaveLength(1);
  });

  // ── SENSITIVE_FIELDS ───────────────────────────────────────────────────────
  it("SENSITIVE_FIELDS.cliente incluye rfc y email", () => {
    expect(SENSITIVE_FIELDS.cliente).toContain("rfc");
    expect(SENSITIVE_FIELDS.cliente).toContain("email");
  });

  it("SENSITIVE_FIELDS.embarque incluye estado y modo", () => {
    expect(SENSITIVE_FIELDS.embarque).toContain("estado");
    expect(SENSITIVE_FIELDS.embarque).toContain("modo");
  });

  // ── diffConceptos ──────────────────────────────────────────────────────────
  it("diffConceptos: retorna 0 cambios cuando ambas listas son null", () => {
    const r = diffConceptos(null, null);
    expect(r).toEqual({ agregados: 0, eliminados: 0, modificados: 0, detalle: [] });
  });

  it("diffConceptos: detecta concepto agregado", () => {
    const after: ConceptoLike[] = [{ concepto: "Flete", monto: 500, moneda: "USD" }];
    const r = diffConceptos([], after);
    expect(r.agregados).toBe(1);
    expect(r.detalle[0].tipo).toBe("agregado");
  });

  it("diffConceptos: detecta concepto eliminado", () => {
    const before: ConceptoLike[] = [{ concepto: "Aduana", monto: 300, moneda: "MXN" }];
    const r = diffConceptos(before, []);
    expect(r.eliminados).toBe(1);
    expect(r.detalle[0].tipo).toBe("eliminado");
  });

  it("diffConceptos: detecta modificación de monto", () => {
    const before: ConceptoLike[] = [{ concepto: "Handling", monto: 100, moneda: "USD" }];
    const after: ConceptoLike[]  = [{ concepto: "Handling", monto: 200, moneda: "USD" }];
    const r = diffConceptos(before, after);
    expect(r.modificados).toBe(1);
    expect(r.detalle[0].tipo).toBe("modificado");
    expect(r.detalle[0].antes).toBe("100.00 USD");
    expect(r.detalle[0].despues).toBe("200.00 USD");
  });

  it("diffConceptos: sin cambios cuando listas son idénticas", () => {
    const lista: ConceptoLike[] = [{ concepto: "Flete", monto: 500, moneda: "MXN" }];
    const r = diffConceptos(lista, lista);
    expect(r).toEqual({ agregados: 0, eliminados: 0, modificados: 0, detalle: [] });
  });
});
