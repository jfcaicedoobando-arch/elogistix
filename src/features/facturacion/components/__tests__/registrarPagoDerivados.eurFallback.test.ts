import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchExchangeRates, EXCHANGE_RATES_FALLBACK } from "@/features/catalogos/services/exchangeRates";
import { derivarEstadoPago } from "../registrarPagoDerivados";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));

const base = {
  monto: "1", saldo: 116, fecha: "2026-10-12", hoy: "2026-10-12",
  metodoPagoFactura: "PPD", formaPago: "03",
};
const paresEur = [
  { monedaPago: "EUR", monedaFactura: "EUR" },
  { monedaPago: "EUR", monedaFactura: "MXN" },
  { monedaPago: "MXN", monedaFactura: "EUR" },
];
const paresSinEur = [
  { monedaPago: "USD", monedaFactura: "USD" },
  { monedaPago: "USD", monedaFactura: "MXN" },
  { monedaPago: "MXN", monedaFactura: "USD" },
  { monedaPago: "MXN", monedaFactura: "MXN" },
];

beforeEach(() => {
  invoke.mockResolvedValue({ data: {
    usdMxn: 18.4163, eurMxn: null, es_fallback: false, eur_es_fallback: true,
  }, error: null });
});

describe("respaldo EUR en Registrar pago", () => {
  it.each(paresEur)("bloquea EUR estimado en $monedaPago → $monedaFactura", async (par) => {
    const rates = await fetchExchangeRates(base.fecha);
    expect(rates).toMatchObject({ esFallback: false, eurEsFallback: true, eurMxn: 18.5 });
    for (const tcManual of [undefined, "", "   "]) {
      const d = derivarEstadoPago({ ...base, ...par, rates, tcManual });
      expect(d).toMatchObject({ tcRespaldo: true, tcBloqueado: true, invalido: true });
    }
  });

  it.each(paresEur)("respeta la marca EUR explícita con valor presente en $monedaPago → $monedaFactura", async (par) => {
    invoke.mockResolvedValue({ data: { usdMxn: 18.4163, eurMxn: 20, eur_es_fallback: true }, error: null });
    expect(derivarEstadoPago({ ...base, ...par, rates: await fetchExchangeRates() }).tcBloqueado).toBe(true);
  });

  it.each(paresEur)("admite TC manual válido en $monedaPago → $monedaFactura", async (par) => {
    const d = derivarEstadoPago({ ...base, ...par, rates: await fetchExchangeRates(), tcManual: "21" });
    expect(d).toMatchObject({ tipoCambio: 21, tcRespaldo: false, tcBloqueado: false, invalido: false });
  });

  it.each(["0", "-1", "4.99", "40.01", "Infinity", "NaN", "abc"])("rechaza TC manual inválido %s", async (tcManual) => {
    for (const par of paresEur) {
      expect(derivarEstadoPago({ ...base, ...par, rates: await fetchExchangeRates(), tcManual }))
        .toMatchObject({ tcBloqueado: true, invalido: true });
    }
  });

  it.each(paresSinEur)("no bloquea $monedaPago → $monedaFactura por respaldo exclusivo EUR", async (par) => {
    expect(derivarEstadoPago({ ...base, ...par, rates: await fetchExchangeRates() }))
      .toMatchObject({ tcRespaldo: false, tcBloqueado: false, invalido: false });
  });

  it.each(paresEur)("admite EUR fiable en $monedaPago → $monedaFactura", async (par) => {
    invoke.mockResolvedValue({ data: { usdMxn: 18.4163, eurMxn: 21, eur_es_fallback: false }, error: null });
    expect(derivarEstadoPago({ ...base, ...par, rates: await fetchExchangeRates() }))
      .toMatchObject({ tipoCambio: 21, tcRespaldo: false, tcBloqueado: false, invalido: false });
  });

  it.each([...paresEur, ...paresSinEur.slice(0, 3)])("mantiene el bloqueo del respaldo global en $monedaPago → $monedaFactura", (par) => {
    expect(derivarEstadoPago({ ...base, ...par, rates: EXCHANGE_RATES_FALLBACK }))
      .toMatchObject({ tcRespaldo: true, tcBloqueado: true, invalido: true });
  });

  it.each([
    { monedaPago: "USD", monedaFactura: "EUR" },
    { monedaPago: "EUR", monedaFactura: "USD" },
  ])("no habilita cruces no soportados con TC manual: $monedaPago → $monedaFactura", async (par) => {
    expect(derivarEstadoPago({ ...base, ...par, rates: await fetchExchangeRates(), tcManual: "21" }))
      .toMatchObject({ cruceNoSoportado: true, tcBloqueado: true, invalido: true });
  });
});
