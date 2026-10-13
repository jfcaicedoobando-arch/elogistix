import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
import { cargoEnMonedaCuenta } from "../pagoProveedorMovimiento";

describe("cargoEnMonedaCuenta", () => {
  it("no convierte cuando la cuenta es en la misma moneda del pago", () => {
    expect(cargoEnMonedaCuenta(23650, "USD", "USD", 17.2067)).toBe(23650);
    expect(cargoEnMonedaCuenta(1000, "MXN", "MXN", 17.2067)).toBe(1000);
  });

  it("convierte USD→MXN cuando la cuenta es en pesos", () => {
    expect(cargoEnMonedaCuenta(100, "USD", "MXN", 17)).toBe(1700);
  });

  it("convierte MXN→USD cuando la cuenta es en dólares", () => {
    expect(cargoEnMonedaCuenta(1700, "MXN", "USD", 17)).toBe(100);
  });

  it("MNY-NEW-04: nunca registra 1:1 sin tipo de cambio (fail-closed)", () => {
    expect(cargoEnMonedaCuenta(500, "USD", "MXN", null)).toBeNull();
    expect(cargoEnMonedaCuenta(500, "USD", "MXN", 0)).toBeNull();
    expect(cargoEnMonedaCuenta(500, "EUR", "MXN", 17)).toBeNull();
  });

  it.each([null, "", "   "])("sin moneda de cuenta (%j) rechaza la equivalencia 1:1", (monedaCuenta) => {
    expect(cargoEnMonedaCuenta(500, "USD", monedaCuenta, 17)).toBeNull();
    expect(cargoEnMonedaCuenta(500, "MXN", monedaCuenta, null)).toBeNull();
  });

  it.each(["MXN", "USD"])("conserva %s en la misma moneda sin exigir TC", (moneda) => {
    expect(cargoEnMonedaCuenta(500, moneda, moneda, null)).toBe(500);
  });
});
