/**
 * Tests puros de `calcularKpisProyeccion` y `sumarConceptosEnMxn/Usd`.
 * Cubre cierre fiscal mensual y consolidación multi-moneda.
 *
 * Phase 3.1 cont. — Auditoría 13.14.2.
 */
import { describe, it, expect } from "vitest";
import { calcularKpisProyeccion } from "../kpis";
import { sumarConceptosEnMxn, sumarConceptosEnUsd } from "../conversion";
import type { GrupoProyeccion } from "../types";

const grupo = (over: Partial<GrupoProyeccion> = {}): GrupoProyeccion => ({
  expediente: "EXP-1",
  sinTc: false,
  cliente_nombre: "ACME",
  operador: "JD",
  eta: "2026-06-30",
  contenedores: ["MSCU1"],
  totalContenedores: 1,
  ventaMxn: 10000,
  ventaUsd: 540,
  costoMxn: 7000,
  costoUsd: 380,
  profitMxn: 3000,
  profitUsd: 160,
  margenPct: 30,
  estado: "Facturado",
  embarqueIds: ["e1"],
  ...over,
});

describe("calcularKpisProyeccion [kpis.ts unit]", () => {
  it("totales y avance con mezcla facturado/pendiente", () => {
    const kpis = calcularKpisProyeccion([
      grupo({ estado: "Facturado" }),
      grupo({ estado: "Pendiente", ventaMxn: 5000, costoMxn: 4000, profitMxn: 1000 }),
    ]);
    expect(kpis.totalExpedientes).toBe(2);
    expect(kpis.facturados).toBe(1);
    expect(kpis.pendientes).toBe(1);
    expect(kpis.ventaProyMxn).toBe(15000);
    expect(kpis.ventaFacturadaMxn).toBe(10000);
    expect(kpis.ventaPendienteMxn).toBe(5000);
    expect(kpis.costoTotalMxn).toBe(11000);
    expect(kpis.profitProyMxn).toBe(4000);
    expect(kpis.profitFacturadoMxn).toBe(3000);
    expect(kpis.avancePct).toBe(50);
    expect(kpis.margenProyPct).toBeCloseTo((4000 / 15000) * 100, 2);
  });

  it("lista vacía → todos los totales 0 y avance 0", () => {
    const k = calcularKpisProyeccion([]);
    expect(k.totalExpedientes).toBe(0);
    expect(k.ventaProyMxn).toBe(0);
    expect(k.avancePct).toBe(0);
    expect(k.margenProyPct).toBe(0);
  });

  it("avance 100% cuando todo está facturado", () => {
    const k = calcularKpisProyeccion([grupo(), grupo({ expediente: "EXP-2" })]);
    expect(k.avancePct).toBe(100);
    expect(k.pendientes).toBe(0);
  });
});

describe("sumarConceptosEnMxn/Usd", () => {
  const tcUsd = 18.5;
  const tcEur = 20;

  it("MXN: suma directa sin conversión", () => {
    expect(sumarConceptosEnMxn([{ monto: 100, moneda: "MXN" }, { monto: 50, moneda: "MXN" }], tcUsd, tcEur)).toBe(150);
  });

  it("USD a MXN multiplica por tcUsd", () => {
    expect(sumarConceptosEnMxn([{ monto: 10, moneda: "USD" }], tcUsd, tcEur)).toBeCloseTo(185, 2);
  });

  it("EUR a MXN multiplica por tcEur", () => {
    expect(sumarConceptosEnMxn([{ monto: 10, moneda: "EUR" }], tcUsd, tcEur)).toBeCloseTo(200, 2);
  });

  it("moneda undefined/lowercase default → MXN", () => {
    expect(sumarConceptosEnMxn([{ monto: 100, moneda: "" }], tcUsd, tcEur)).toBe(100);
    expect(sumarConceptosEnMxn([{ monto: 100, moneda: "usd" }], tcUsd, tcEur)).toBeCloseTo(1850, 2);
  });

  it("EnUsd: tcUsd<=0 devuelve 0 sin division by zero", () => {
    expect(sumarConceptosEnUsd([{ monto: 100, moneda: "MXN" }], 0, tcEur)).toBe(0);
    expect(sumarConceptosEnUsd([{ monto: 100, moneda: "MXN" }], -1, tcEur)).toBe(0);
  });

  it("EnUsd: convierte MXN/EUR a USD", () => {
    // 1850 MXN /18.5 = 100 USD; 10 EUR *20/18.5 ≈ 10.81 USD; 50 USD directo
    const total = sumarConceptosEnUsd(
      [{ monto: 1850, moneda: "MXN" }, { monto: 10, moneda: "EUR" }, { monto: 50, moneda: "USD" }],
      tcUsd,
      tcEur,
    );
    expect(total).toBeCloseTo(100 + (10 * 20) / 18.5 + 50, 2);
  });
});
