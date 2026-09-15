/**
 * MNY-08 — el aviso de tipo de cambio sólo debe listar las monedas que de
 * verdad quedaron fuera del saldo bancario total.
 */
import { describe, it, expect } from "vitest";
import { sumarSaldosCuentas } from "@/features/tesoreria/domain/resumen";

const cuentas = [
  { id: "1", alias: "BBVA MXN", banco: "BBVA", moneda: "MXN", saldo: 1000 },
  { id: "2", alias: "BBVA USD", banco: "BBVA", moneda: "USD", saldo: 100 },
  { id: "3", alias: "BBVA EUR", banco: "BBVA", moneda: "EUR", saldo: 50 },
  // SAFE-CAST: la firma sólo consume moneda y saldo de cada cuenta.
] as unknown as Parameters<typeof sumarSaldosCuentas>[0];

describe("sumarSaldosCuentas · monedas excluidas (MNY-08)", () => {
  it("con TC de USD y sin TC de EUR, sólo excluye EUR", () => {
    const r = sumarSaldosCuentas(cuentas, { usd: 20, eur: null });
    expect(r.monedasExcluidas).toEqual(["EUR"]);
    expect(r.incompleto).toBe(true);
    expect(r.total).toBe(3000);
    expect(r.porMoneda.EUR).toBe(50);
  });

  it("con todos los tipos de cambio no excluye nada", () => {
    const r = sumarSaldosCuentas(cuentas, { usd: 20, eur: 22 });
    expect(r.monedasExcluidas).toEqual([]);
    expect(r.incompleto).toBe(false);
  });
});
