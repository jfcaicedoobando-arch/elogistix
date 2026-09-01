/** v13.823.21 — Edición en memoria de conceptos extraídos por IA. */
import { describe, expect, it } from "vitest";
import { editarConceptoIa, eliminarConceptoIa } from "../conceptosIa";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

const base: CfdiConceptoParsed[] = [
  { descripcion: "Flete", cantidad: 1, importe: 100, iva: 16, ieps: 0 },
  { descripcion: "Maniobra", cantidad: 2, importe: 50, iva: 0, ieps: 0 },
];

describe("editarConceptoIa", () => {
  it("parcha sólo el renglón indicado y no muta el original", () => {
    const out = editarConceptoIa(base, 1, { importe: 75 });
    expect(out[1]).toEqual({ descripcion: "Maniobra", cantidad: 2, importe: 75, iva: 0, ieps: 0 });
    expect(out[0]).toEqual(base[0]);
    expect(base[1].importe).toBe(50);
  });

  it("ignora índices fuera de rango", () => {
    expect(editarConceptoIa(base, 9, { importe: 1 })).toEqual(base);
    expect(editarConceptoIa(base, -1, { importe: 1 })).toEqual(base);
  });
});

describe("eliminarConceptoIa", () => {
  it("quita el renglón sobrante", () => {
    expect(eliminarConceptoIa(base, 0)).toEqual([base[1]]);
  });

  it("ignora índices fuera de rango", () => {
    expect(eliminarConceptoIa(base, 5)).toEqual(base);
  });
});
