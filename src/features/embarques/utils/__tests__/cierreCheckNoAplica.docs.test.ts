/**
 * v13.823.370 (P2-5) — Sin requisitos documentales registrados, `faltantes = 0`
 * no significa "documentos requeridos completos": el check no es evaluable y no
 * debe pintarse en verde. El candado de cierre no cambia.
 */
import { describe, it, expect } from "vitest";
import {
  calcularReglasNoAplica,
  MOTIVO_SIN_REQUISITOS_DOCUMENTALES,
  type CheckMinimo,
} from "../cierreCheckNoAplica";

const checks: CheckMinimo[] = [
  { regla: "docs_completos", ok: true, detalle: { faltantes: 0 } },
  { regla: "contenedores_datos_completos", ok: true, detalle: {} },
];

describe("calcularReglasNoAplica · documentos", () => {
  it("sin requisitos documentales marca el check como no evaluable", () => {
    const r = calcularReglasNoAplica(checks, { sinRequisitosDocumentales: true });
    expect(r.get("docs_completos")).toBe(MOTIVO_SIN_REQUISITOS_DOCUMENTALES);
  });

  it("con requisitos documentales conserva el comportamiento actual", () => {
    const r = calcularReglasNoAplica(checks, { sinRequisitosDocumentales: false });
    expect(r.has("docs_completos")).toBe(false);
  });

  it("por omisión (sin la opción) no cambia nada", () => {
    expect(calcularReglasNoAplica(checks).has("docs_completos")).toBe(false);
  });

  it("no afecta a otras reglas", () => {
    const r = calcularReglasNoAplica(checks, { sinRequisitosDocumentales: true });
    expect(r.has("contenedores_datos_completos")).toBe(false);
  });
});
