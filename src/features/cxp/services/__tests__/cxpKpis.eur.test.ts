/**
 * MNY-NEW-07 — el euro tiene cubeta propia. Antes cualquier moneda distinta de
 * USD caía en la cubeta MXN, así que un saldo en EUR se presentaba como pesos.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { calcularKPIsCxP } from "../cxpKpis";
import type { FacturaCxP } from "../proveedorFacturas";

const HOY = new Date("2026-06-26T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(HOY);
});

const f = (over: Partial<FacturaCxP>): FacturaCxP =>
  ({
    saldo: 0, moneda: "MXN", dias_vencido: 0, fecha_vencimiento: null,
    estatus: "Vigente", ...over,
  }) as FacturaCxP;

describe("calcularKPIsCxP · cubeta EUR (MNY-NEW-07)", () => {
  it("separa MXN, USD y EUR en por pagar", () => {
    const k = calcularKPIsCxP([
      f({ saldo: 100, moneda: "MXN" }),
      f({ saldo: 50, moneda: "USD" }),
      f({ saldo: 30, moneda: "EUR" }),
    ]);
    expect(k.por_pagar_mxn).toBe(100);
    expect(k.por_pagar_usd).toBe(50);
    expect(k.por_pagar_eur).toBe(30);
  });

  it("no suma el EUR dentro de la cubeta MXN", () => {
    const k = calcularKPIsCxP([f({ saldo: 30, moneda: "EUR" })]);
    expect(k.por_pagar_mxn).toBe(0);
    expect(k.por_pagar_eur).toBe(30);
  });

  it("acumula el vencido EUR en su propia cubeta", () => {
    const k = calcularKPIsCxP([
      f({ saldo: 30, moneda: "EUR", dias_vencido: 10, fecha_vencimiento: "2026-06-16" }),
      f({ saldo: 40, moneda: "USD", dias_vencido: 10, fecha_vencimiento: "2026-06-16" }),
    ]);
    expect(k.vencido_eur).toBe(30);
    expect(k.vencido_usd).toBe(40);
    expect(k.vencido_mxn).toBe(0);
    expect(k.facturas_vencidas).toBe(2);
  });

  it("acumula por vencer 7d en EUR", () => {
    const k = calcularKPIsCxP([
      f({ saldo: 25, moneda: "EUR", dias_vencido: 0, fecha_vencimiento: "2026-06-30" }),
    ]);
    expect(k.por_vencer_7d_eur).toBe(25);
    expect(k.por_vencer_7d_mxn).toBe(0);
  });
});
