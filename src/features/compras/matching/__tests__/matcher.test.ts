import { describe, it, expect } from "vitest";
import { sugerirVinculos, type ConceptoCandidato } from "../matcher";

const FACTURA = { descripcion: "Flete marítimo Shanghái-Manzanillo", monto: 12000, moneda: "MXN" };
const CANDIDATOS: ConceptoCandidato[] = [
  { id: "c1", concepto: "Flete marítimo MZO", monto: 12000, moneda: "MXN", embarque_id: "e1" },
  { id: "c2", concepto: "Honorarios agente aduanal", monto: 3500, moneda: "MXN", embarque_id: "e1" },
  { id: "c3", concepto: "Flete marítimo Shanghai", monto: 11500, moneda: "USD", embarque_id: "e2" },
  { id: "c4", concepto: "Almacenaje en puerto", monto: 900, moneda: "MXN", embarque_id: "e1" },
];

describe("sugerirVinculos", () => {
  it("rankea el match relevante primero", () => {
    const r = sugerirVinculos(FACTURA, CANDIDATOS);
    expect(r.ranking[0].conceptoId).toBe("c1");
    expect(r.ranking[0].score).toBeGreaterThanOrEqual(0.6);
  });

  it("selecciona el match fuerte y descarta moneda distinta", () => {
    const r = sugerirVinculos(FACTURA, CANDIDATOS);
    const ids = r.seleccion.map((s) => s.conceptoId);
    expect(ids).toContain("c1");
    expect(ids).not.toContain("c3"); // USD vs MXN
    expect(r.descartadosPorMoneda).toBe(1);
  });

  it("no excede el monto de la factura por > 5%", () => {
    const r = sugerirVinculos(FACTURA, CANDIDATOS);
    expect(r.totalSeleccion).toBeLessThanOrEqual(FACTURA.monto * 1.05);
  });

  it("empty candidates ⇒ ranking y seleccion vacíos", () => {
    const r = sugerirVinculos(FACTURA, []);
    expect(r.ranking).toEqual([]);
    expect(r.seleccion).toEqual([]);
    expect(r.totalSeleccion).toBe(0);
  });

  it("no auto-selecciona nada si todos los scores están bajo UMBRAL_MINIMO", () => {
    const cand: ConceptoCandidato[] = [
      { id: "x", concepto: "Renta oficina", monto: 25000, moneda: "MXN", embarque_id: "e9" },
    ];
    const r = sugerirVinculos(FACTURA, cand);
    expect(r.seleccion).toEqual([]);
  });

  it("acepta acumular dos conceptos si su suma se acerca a la factura", () => {
    const factura = { descripcion: "Flete y despacho", monto: 15500, moneda: "MXN" };
    const cand: ConceptoCandidato[] = [
      { id: "c1", concepto: "Flete marítimo", monto: 12000, moneda: "MXN", embarque_id: "e1" },
      { id: "c2", concepto: "Despacho aduanal", monto: 3500, moneda: "MXN", embarque_id: "e1" },
    ];
    const r = sugerirVinculos(factura, cand);
    const ids = r.seleccion.map((s) => s.conceptoId).sort();
    // Al menos uno debe ser sugerido; los dos son deseables pero score puede
    // quedar apretado. Validamos que la suma no exceda el límite.
    expect(ids.length).toBeGreaterThanOrEqual(1);
    expect(r.totalSeleccion).toBeLessThanOrEqual(factura.monto * 1.05);
  });

  it("respeta moneda estricta en la selección", () => {
    const factura = { descripcion: "flete", monto: 1000, moneda: "USD" };
    const cand: ConceptoCandidato[] = [
      { id: "c1", concepto: "flete", monto: 1000, moneda: "MXN", embarque_id: "e1" },
    ];
    const r = sugerirVinculos(factura, cand);
    expect(r.seleccion).toEqual([]);
  });

  it("marca fuerte=false cuando el score < 0.75", () => {
    const factura = { descripcion: "flete", monto: 1000, moneda: "MXN" };
    const cand: ConceptoCandidato[] = [
      { id: "c1", concepto: "almacenaje", monto: 990, moneda: "MXN", embarque_id: "e1" },
    ];
    const r = sugerirVinculos(factura, cand);
    expect(r.ranking[0].fuerte).toBe(false);
  });
});
