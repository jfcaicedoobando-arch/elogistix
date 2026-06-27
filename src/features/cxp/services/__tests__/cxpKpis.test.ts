/**
 * Tests de KPIs de CxP. Cubre separación por moneda (MXN/USD),
 * acumulación de vencidos vs por-vencer-7d y exclusión de filas
 * sin saldo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { calcularKPIsCxP } from "../cxpKpis";
import type { FacturaCxP } from "../proveedorFacturas";

const HOY = new Date("2026-06-26T12:00:00Z");
// v13.137.35: el global `afterEach` de `src/test/setup.ts` invoca
// `vi.useRealTimers()`, lo que anula `beforeAll(useFakeTimers)`.
// Reinstalamos el reloj fijo en cada test para que los KPIs basados en
// `new Date()` (ver `cxpKpis.ts`) sean deterministas.
// v13.137.43: limitamos `toFake` a `["Date"]`. El default de vitest 3
// también intercepta `queueMicrotask`/`setImmediate`, lo que cuelga la
// inicialización del fork (shard 9 quedaba en timeout de 20min en CI).
// Sólo necesitamos congelar la fecha del sistema para los KPIs.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOY);
});

const f = (over: Partial<FacturaCxP>): FacturaCxP =>
  ({ saldo: 0, moneda: "MXN", dias_vencido: 0, fecha_vencimiento: null, estatus: "Vigente", ...over } as FacturaCxP);

describe("calcularKPIsCxP", () => {
  it("ignora filas de CxP con saldo <= 0", () => {
    const k = calcularKPIsCxP([f({ saldo: 0, moneda: "MXN" })]);
    expect(k.por_pagar_mxn).toBe(0);
    expect(k.por_pagar_usd).toBe(0);
  });

  it("separa por moneda MXN vs USD", () => {
    const k = calcularKPIsCxP([
      f({ saldo: 100, moneda: "MXN" }),
      f({ saldo: 50, moneda: "USD" }),
    ]);
    expect(k.por_pagar_mxn).toBe(100);
    expect(k.por_pagar_usd).toBe(50);
  });

  it("acumula vencidas y cuenta facturas", () => {
    const k = calcularKPIsCxP([
      f({ saldo: 200, moneda: "MXN", estatus: "Vencida", dias_vencido: 5 }),
      f({ saldo: 300, moneda: "USD", estatus: "Vencida", dias_vencido: 1 }),
      f({ saldo: 50, moneda: "MXN", estatus: "Vigente" }),
    ]);
    expect(k.vencido_mxn).toBe(200);
    expect(k.vencido_usd).toBe(300);
    expect(k.facturas_vencidas).toBe(2);
  });

  it("por_vencer_7d cuenta sólo facturas con vencimiento dentro de 7 días y dias_vencido=0", () => {
    const k = calcularKPIsCxP([
      // vence en 5 días (dv = -5), entra
      f({ saldo: 80, moneda: "MXN", dias_vencido: 0, fecha_vencimiento: "2026-07-01" }),
      // vence en 30 días, NO entra
      f({ saldo: 40, moneda: "MXN", dias_vencido: 0, fecha_vencimiento: "2026-07-26" }),
      // ya vencida, dias_vencido > 0 ⇒ NO entra en por_vencer
      f({ saldo: 99, moneda: "USD", dias_vencido: 3, fecha_vencimiento: "2026-06-23", estatus: "Vencida" }),
    ]);
    expect(k.por_vencer_7d_mxn).toBe(80);
    expect(k.por_vencer_7d_usd).toBe(0);
  });
});
