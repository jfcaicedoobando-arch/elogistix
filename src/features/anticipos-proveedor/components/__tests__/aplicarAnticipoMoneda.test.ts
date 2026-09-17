/**
 * Lote P2 (item 5): el monto se captura en la moneda del ANTICIPO, así que el
 * límite y el mensaje de error deben usar esa moneda (antes siempre MXN).
 */
import { describe, it, expect } from "vitest";
import { buildSchema } from "../AplicarAnticipoDialog";

function mensajeDeMonto(moneda: string) {
  const res = buildSchema(1000, moneda).safeParse({
    facturaId: "11111111-1111-4111-8111-111111111111",
    saldoFactura: 5000,
    monedaFactura: moneda,
    monto: 1500,
    fechaAplicacion: "2026-06-10",
  });
  expect(res.success).toBe(false);
  return res.success ? "" : res.error.issues.map((i) => i.message).join(" | ");
}

describe("AplicarAnticipoDialog · límite del anticipo por moneda", () => {
  it.each([
    ["MXN", "MXN"],
    ["USD", "USD"],
    ["EUR", "EUR"],
  ])("el mensaje del anticipo en %s no menciona otra moneda", (moneda, marca) => {
    const msg = mensajeDeMonto(moneda);
    expect(msg).toContain("saldo disponible del anticipo");
    expect(msg).toContain(marca);
    for (const otra of ["MXN", "USD", "EUR"].filter((m) => m !== moneda)) {
      expect(msg).not.toContain(otra);
    }
  });

  it("acepta un monto dentro del disponible", () => {
    const res = buildSchema(1000, "EUR").safeParse({
      facturaId: "11111111-1111-4111-8111-111111111111",
      saldoFactura: 5000, monedaFactura: "EUR", monto: 900,
      fechaAplicacion: "2026-06-10",
    });
    expect(res.success).toBe(true);
  });
});
