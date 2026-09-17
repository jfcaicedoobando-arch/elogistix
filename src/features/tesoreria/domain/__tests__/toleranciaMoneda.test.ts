/**
 * MNY P1.2: la tolerancia de conciliación depende de la moneda del importe.
 * Un peso de diferencia es redondeo bancario; un dólar o un euro no lo son.
 */
import { describe, expect, it } from "vitest";
import { toleranciaMonto } from "../tolerancia";
import { montosCuadran } from "../conciliacionMonto";
import { encontrarCandidatosExactos } from "../conciliacionMatcher";
import type { MovimientoBBVA } from "../../services/conciliacion";
import type { Candidato } from "../../services/sugerirCandidatos";

const candidato = (moneda: string, monto: number): Candidato => ({
  tipo: "cxp",
  pago_id: `p-${moneda}-${monto}`,
  fecha: "2026-05-10",
  referencia: "REF",
  monto,
  moneda,
  contraparte: "Prov",
  delta_dias: 0,
  delta_monto: 0,
});

const mov = (cargo: number): MovimientoBBVA =>
  ({ fecha: "2026-05-10", cargo, abono: 0 }) as unknown as MovimientoBBVA;

describe("toleranciaMonto", () => {
  it("usa un peso para MXN y centavos para divisas", () => {
    expect(toleranciaMonto("MXN")).toBe(1);
    expect(toleranciaMonto("USD")).toBe(0.05);
    expect(toleranciaMonto("EUR")).toBe(0.05);
  });

  it("falla cerrado con moneda desconocida o ausente", () => {
    expect(toleranciaMonto(null)).toBe(0);
    expect(toleranciaMonto("JPY")).toBe(0);
  });
});

describe("montosCuadran por moneda", () => {
  it("acepta un peso de diferencia en MXN", () => {
    expect(montosCuadran(10000, 9999, "MXN")).toBe(true);
  });

  it("rechaza un dólar de diferencia en USD", () => {
    expect(montosCuadran(1000, 999, "USD")).toBe(false);
    expect(montosCuadran(1000, 999.97, "USD")).toBe(true);
  });

  it("rechaza un euro de diferencia en EUR", () => {
    expect(montosCuadran(1000, 999, "EUR")).toBe(false);
  });

  it("exige coincidencia exacta con moneda desconocida", () => {
    expect(montosCuadran(1000, 1000.5, "JPY")).toBe(false);
    expect(montosCuadran(1000, 1000, "JPY")).toBe(true);
  });
});

describe("encontrarCandidatosExactos por moneda", () => {
  it("no ofrece un pago en USD con un dólar de diferencia", () => {
    const exactos = encontrarCandidatosExactos(mov(1000), [candidato("USD", 999)]);
    expect(exactos).toHaveLength(0);
  });

  it("sí ofrece el pago en MXN con un peso de diferencia", () => {
    const exactos = encontrarCandidatosExactos(mov(1000), [candidato("MXN", 999)]);
    expect(exactos).toHaveLength(1);
  });
});
