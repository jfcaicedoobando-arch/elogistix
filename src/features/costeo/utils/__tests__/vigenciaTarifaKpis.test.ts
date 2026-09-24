import { describe, it, expect } from "vitest";
import {
  calcularKpisTarifas, coincideBusqueda, esTarifaPorVencerEn, resolverEstadoVigenciaTarifa,
} from "../vigenciaTarifa";

const HOY = "2026-09-24";
const t = (o: Partial<{ vigente_desde: string; vigente_hasta: string; estado: string; estado_aprobacion: string; ruta_id: string }>) => ({
  vigente_desde: "2026-09-01", vigente_hasta: "2026-12-31", estado: "activa", estado_aprobacion: "vigente", ruta_id: "r1", ...o,
});

describe("P1-1 · KPIs con vigencia real", () => {
  it("tarifa aprobada 15/10–15/11 no cuenta como vigente hoy (24/09)", () => {
    const k = calcularKpisTarifas([t({ vigente_desde: "2026-10-15", vigente_hasta: "2026-11-15" })], HOY);
    expect(k.vigentes).toBe(0);
    expect(k.porVencer).toBe(0);
    expect(k.rutasCubiertas).toBe(0);
  });
  it("por vencer = [hoy, hoy+7] con límites date-only (fin de mes)", () => {
    expect(esTarifaPorVencerEn(t({ vigente_hasta: "2026-09-24" }), HOY)).toBe(true);
    expect(esTarifaPorVencerEn(t({ vigente_hasta: "2026-10-01" }), HOY)).toBe(true);
    expect(esTarifaPorVencerEn(t({ vigente_hasta: "2026-10-02" }), HOY)).toBe(false);
    expect(esTarifaPorVencerEn(t({ vigente_hasta: "2027-01-02" }), "2026-12-26")).toBe(true);
  });
  it("reemplazada no cuenta", () => {
    expect(calcularKpisTarifas([t({ estado: "reemplazada" })], HOY).vigentes).toBe(0);
  });
  it("estado visual: aprobada futura → 'Aprobada · inicia 15/10/2026'", () => {
    const r = resolverEstadoVigenciaTarifa({ estadoAprobacion: "vigente", vigenteDesde: "2026-10-15", vigenteHasta: "2026-11-15", hoy: HOY });
    expect(r.programada).toBe(true);
    expect(r.advertencia).toBe("Aprobada · inicia 15/10/2026");
  });
});

describe("P2-4/P2-5 · pendientes y rutas", () => {
  it("separa borradores aprobables de vencidos (3 + 5)", () => {
    const rows = [
      ...Array.from({ length: 3 }, () => t({ estado_aprobacion: "borrador" })),
      ...Array.from({ length: 5 }, () => t({ estado_aprobacion: "borrador", vigente_hasta: "2026-07-06" })),
    ];
    const k = calcularKpisTarifas(rows, HOY);
    expect(k.pendientes).toBe(3);
    expect(k.borradoresVencidos).toBe(5);
  });
  it("ruta con sólo borrador vencido no está cubierta", () => {
    const k = calcularKpisTarifas([t({ ruta_id: "r2", estado_aprobacion: "borrador", vigente_hasta: "2026-07-06" }), t({})], HOY);
    expect(k.rutasCubiertas).toBe(1);
  });
});

describe("P2-6 · búsqueda por términos", () => {
  const hay = "Ningbo China CNNGB Lázaro Cárdenas México MXLZC Chino El Agente COSCO";
  it("términos no contiguos y sin acentos", () => {
    expect(coincideBusqueda(hay, "Ningbo Lázaro")).toBe(true);
    expect(coincideBusqueda(hay, "ningbo lazaro")).toBe(true);
    expect(coincideBusqueda(hay, "CNNGB MXLZC")).toBe(true);
    expect(coincideBusqueda(hay, "Lázaro")).toBe(true);
  });
  it("caso negativo: un término ausente", () => {
    expect(coincideBusqueda(hay, "Ningbo Manzanillo")).toBe(false);
  });
});
