/**
 * Pruebas de los helpers puros de reportes dinámicos (Fase 7).
 */
import { describe, expect, it } from "vitest";
import {
  AGRUPACIONES,
  filtroAJson,
  filtroDesdeJson,
  validarReporte,
} from "@/features/crm/services/reportes/tiposReportes";

describe("filtroDesdeJson", () => {
  it("devuelve vacío ante valores no objeto", () => {
    expect(filtroDesdeJson(null)).toEqual({});
    expect(filtroDesdeJson("x")).toEqual({});
  });

  it("mapea etapa_id a etapaId e ignora cadenas vacías", () => {
    expect(filtroDesdeJson({ desde: "2026-01-01", etapa_id: "abc", vendedor: "  " })).toEqual({
      desde: "2026-01-01",
      hasta: undefined,
      etapaId: "abc",
      vendedor: undefined,
    });
  });
});

describe("filtroAJson", () => {
  it("solo incluye llaves con valor y usa etapa_id", () => {
    expect(filtroAJson({ desde: "2026-01-01", etapaId: "e1" })).toEqual({ desde: "2026-01-01", etapa_id: "e1" });
    expect(filtroAJson({})).toEqual({});
  });
});

describe("validarReporte", () => {
  it("exige nombre", () => {
    expect(validarReporte({ nombre: "  ", objeto: "empresa", medida: "conteo", agrupacion: "mes" })).toMatch(/nombre/);
  });

  it("rechaza agrupación que no aplica al objeto", () => {
    expect(validarReporte({ nombre: "X", objeto: "empresa", medida: "conteo", agrupacion: "etapa" })).toMatch(/agrupación/);
  });

  it("la suma de montos solo aplica a oportunidades", () => {
    expect(validarReporte({ nombre: "X", objeto: "actividad", medida: "suma_monto_usd", agrupacion: "tipo" })).toMatch(/Oportunidades/);
    expect(validarReporte({ nombre: "X", objeto: "oportunidad", medida: "suma_monto_usd", agrupacion: "etapa" })).toBeNull();
  });

  it("toda agrupación del catálogo es válida para su objeto", () => {
    for (const [objeto, lista] of Object.entries(AGRUPACIONES)) {
      for (const a of lista) {
        expect(validarReporte({ nombre: "X", objeto: objeto as keyof typeof AGRUPACIONES, medida: "conteo", agrupacion: a.valor })).toBeNull();
      }
    }
  });
});
