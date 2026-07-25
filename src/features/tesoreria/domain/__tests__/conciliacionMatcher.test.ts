import { describe, it, expect } from "vitest";
import { encontrarCandidatosExactos, seleccionarMatchUnico } from "../conciliacionMatcher";
import type { MovimientoBBVA } from "../../services/conciliacion";
import type { Candidato } from "../../services/sugerirCandidatos";

describe("conciliacionMatcher", () => {
  const movBase: Partial<MovimientoBBVA> = {
    fecha: "2024-01-10",
    cargo: 100,
    abono: 0,
  };

  const c1: Candidato = {
    tipo: "cxp",
    pago_id: "p1",
    fecha: "2024-01-10",
    monto: 100.00,
    moneda: "MXN",
    referencia: "REF1",
    contraparte: "Prov 1",
    delta_dias: 0,
    delta_monto: 0,
  };

  const c2: Candidato = {
    tipo: "cxp",
    pago_id: "p2",
    fecha: "2024-01-15",
    monto: 100.50,
    moneda: "MXN",
    referencia: "REF2",
    contraparte: "Prov 2",
    delta_dias: 5,
    delta_monto: 0.5,
  };

  const cFueraMonto: Candidato = {
    tipo: "cxp",
    pago_id: "p3",
    fecha: "2024-01-10",
    monto: 102.00,
    moneda: "MXN",
    referencia: "REF3",
    contraparte: "Prov 3",
    delta_dias: 0,
    delta_monto: 2,
  };

  const cFueraFecha: Candidato = {
    tipo: "cxp",
    pago_id: "p4",
    fecha: "2024-01-16",
    monto: 100.00,
    moneda: "MXN",
    referencia: "REF4",
    contraparte: "Prov 4",
    delta_dias: 6,
    delta_monto: 0,
  };

  it("encuentra candidatos dentro de la tolerancia", () => {
    const exactos = encontrarCandidatosExactos(movBase as MovimientoBBVA, [c1, c2, cFueraMonto, cFueraFecha]);
    expect(exactos).toHaveLength(2);
    expect(exactos).toContain(c1);
    expect(exactos).toContain(c2);
  });

  it("seleccionarMatchUnico devuelve el único match", () => {
    expect(seleccionarMatchUnico([c1])).toBe(c1);
  });

  it("seleccionarMatchUnico devuelve null si hay ambigüedad", () => {
    expect(seleccionarMatchUnico([c1, c2])).toBeNull();
  });

  it("seleccionarMatchUnico devuelve null si no hay candidatos", () => {
    expect(seleccionarMatchUnico([])).toBeNull();
  });
});
