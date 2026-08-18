/** v13.503.0 — Cotejo del monto facturado vs costeado. */
import { describe, expect, it } from "vitest";
import {
  cotejarMontoFacturado,
  montoDifiereDelCfdi,
} from "@/features/embarques/domain/montoEntranteCotejo";

describe("cotejarMontoFacturado", () => {
  it("sin monto o sin costos devuelve sin_datos", () => {
    expect(cotejarMontoFacturado({ monto: null, moneda: "MXN", costeadoPorMoneda: { MXN: 100 } }).estado).toBe("sin_datos");
    expect(cotejarMontoFacturado({ monto: 100, moneda: "MXN", costeadoPorMoneda: null }).estado).toBe("sin_datos");
    expect(cotejarMontoFacturado({ monto: 100, moneda: "USD", costeadoPorMoneda: { MXN: 100 } }).estado).toBe("sin_datos");
  });

  it("coincide dentro del 1%", () => {
    const r = cotejarMontoFacturado({ monto: 10050, moneda: "MXN", costeadoPorMoneda: { MXN: 10000 } });
    expect(r.estado).toBe("coincide");
    expect(r.costeado).toBe(10000);
  });

  it("coincide con la tolerancia mínima de $1 en montos chicos", () => {
    expect(cotejarMontoFacturado({ monto: 50.5, moneda: "MXN", costeadoPorMoneda: { MXN: 50 } }).estado).toBe("coincide");
  });

  it("difiere y reporta diferencia y porcentaje", () => {
    const r = cotejarMontoFacturado({ monto: 12000, moneda: "USD", costeadoPorMoneda: { USD: 10000 } });
    expect(r.estado).toBe("difiere");
    expect(r.diferencia).toBe(2000);
    expect(r.porcentaje).toBeCloseTo(0.2);
  });
});

describe("montoDifiereDelCfdi", () => {
  it("es falso cuando falta alguno de los dos", () => {
    expect(montoDifiereDelCfdi(null, 100)).toBe(false);
    expect(montoDifiereDelCfdi(100, null)).toBe(false);
  });

  it("tolera hasta $1 de diferencia", () => {
    expect(montoDifiereDelCfdi(100.5, 100)).toBe(false);
    expect(montoDifiereDelCfdi(105, 100)).toBe(true);
  });
});
