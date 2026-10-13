import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calcularEstadoEmbarque } from "../embarque";
import { esSalidaPendienteDeConfirmar } from "../salidaPendiente";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T23:41:17Z")); });
afterEach(() => vi.useRealTimers());

const calcular = (estado: string, etd: string | null = "2026-09-15", eta: string | null = "2026-10-10", llegada: string | null = null) =>
  calcularEstadoEmbarque("Marítimo", "Importación", etd, eta, estado, llegada);

describe("salida requiere confirmación real", () => {
  it.each(["2026-10-01", "2026-10-12", "2026-11-01", null])("Confirmado no avanza por ETA %s", (eta) => {
    expect(calcular("Confirmado", "2026-09-15", eta)).toBe("Confirmado");
  });
  it("no omite salida confirmada por tener llegada real", () => {
    expect(calcular("Confirmado", "2026-09-15", "2026-10-10", "2026-10-10")).toBe("Confirmado");
  });
  it("no revierte un zarpe al corregir ETD a futuro", () => {
    expect(calcular("En Tránsito", "2026-11-01", "2026-11-10")).toBe("En Tránsito");
  });
  it.each(["Borrador", "Cancelado", "Arribo", "En Aduana", "Entregado", "EIR", "Por liquidar", "Cerrado"])('%s se conserva', (estado) => {
    expect(calcular(estado)).toBe(estado);
  });
  it("conserva el arribo con llegada real de un embarque ya en tránsito", () => {
    expect(calcular("En Tránsito", "2026-09-15", "2026-10-10", "2026-10-10")).toBe("Arribo");
  });
});

describe("alerta ETD vencida separada del estado", () => {
  it("S09 permanece Confirmado y muestra salida pendiente", () => {
    expect(calcular("Confirmado")).toBe("Confirmado");
    expect(esSalidaPendienteDeConfirmar("Confirmado", "2026-09-15")).toBe(true);
  });
  it.each(["2026-10-12", "2026-10-13", null, "", "invalid", "2026-02-31"])("ignora ETD no vencida o inválida %s", (etd) => {
    expect(esSalidaPendienteDeConfirmar("Confirmado", etd)).toBe(false);
  });
  it.each(["Borrador", "En Tránsito", "Arribo", "Cancelado", "Cerrado"])("no acusa salida pendiente en %s", (estado) => {
    expect(esSalidaPendienteDeConfirmar(estado, "2026-09-15")).toBe(false);
  });
  it("usa día UTC, independiente del desfase del navegador", () => {
    expect(esSalidaPendienteDeConfirmar("Confirmado", "2026-10-12", new Date("2026-10-12T20:00:00-06:00"))).toBe(true);
  });
});
