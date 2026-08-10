import { describe, it, expect } from "vitest";
import { construirFilaHueco } from "../buildFilas";

const hoy = new Date("2026-08-10T12:00:00Z");

function embarque(tc: number | null) {
  return {
    id: "e1",
    expediente: "001",
    cliente_nombre: "ACME",
    operador: "Ana",
    etd: "2026-07-01",
    eta: "2026-08-01",
    bl_master: null,
    bl_house: null,
    tipo_cambio_usd: tc,
    tipo_cambio_eur: null,
  };
}

describe("Ola 9 · M5 — construirFilaHueco sin tipo de cambio", () => {
  const ventas = new Map([["e1", [{ monto: 100, moneda: "USD" }]]]);

  it("marca sin_tc y no inventa pesos cuando falta el TC", () => {
    const fila = construirFilaHueco(embarque(null), ventas, hoy);
    expect(fila?.sin_tc).toBe(true);
    expect(fila?.ventaMxn).toBe(0);
  });

  it("no marca sin_tc y convierte cuando hay TC", () => {
    const fila = construirFilaHueco(embarque(18), ventas, hoy);
    expect(fila?.sin_tc).toBe(false);
    expect(fila?.ventaMxn).toBe(1800);
  });
});
