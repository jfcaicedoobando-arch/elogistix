import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeRutaEstado, diasParaExpirar, DIAS_POR_VENCER } from "../rutaEstado";
import type { CosteoRuta } from "@/features/costeo/types";

function makeRuta(overrides: Partial<CosteoRuta>): CosteoRuta {
  return {
    id: "r1",
    organization_id: "o1",
    puerto_origen_id: "po",
    puerto_destino_id: "pd",
    activa: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    tarifas_vigentes_count: 0,
    proxima_expiracion: null,
    ultima_actualizacion_tarifa: null,
    proveedores_count: 0,
    ...overrides,
  };
}

describe("computeRutaEstado", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inactiva cuando el flag activa es false", () => {
    const meta = computeRutaEstado(makeRuta({ activa: false, tarifas_vigentes_count: 5 }));
    expect(meta.key).toBe("inactiva");
    expect(meta.tone).toBe("muted");
  });

  it("sin_tarifa cuando está activa pero sin tarifas vigentes", () => {
    const meta = computeRutaEstado(makeRuta({ activa: true, tarifas_vigentes_count: 0 }));
    expect(meta.key).toBe("sin_tarifa");
    expect(meta.tone).toBe("destructive");
  });

  it("por_vencer si la próxima expiración cae dentro del umbral", () => {
    const proxima = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const meta = computeRutaEstado(makeRuta({ tarifas_vigentes_count: 2, proxima_expiracion: proxima }));
    expect(meta.key).toBe("por_vencer");
    expect(meta.tone).toBe("warning");
  });

  it("activa cuando hay tarifas y la próxima expiración está lejos", () => {
    const proxima = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const meta = computeRutaEstado(makeRuta({ tarifas_vigentes_count: 3, proxima_expiracion: proxima }));
    expect(meta.key).toBe("activa");
    expect(meta.tone).toBe("success");
  });

  it("ordena los problemas primero", () => {
    const sin = computeRutaEstado(makeRuta({ tarifas_vigentes_count: 0 }));
    const por = computeRutaEstado(makeRuta({
      tarifas_vigentes_count: 1,
      proxima_expiracion: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
    }));
    const act = computeRutaEstado(makeRuta({
      tarifas_vigentes_count: 1,
      proxima_expiracion: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    }));
    const ina = computeRutaEstado(makeRuta({ activa: false }));
    expect(sin.sortOrder).toBeLessThan(por.sortOrder);
    expect(por.sortOrder).toBeLessThan(act.sortOrder);
    expect(act.sortOrder).toBeLessThan(ina.sortOrder);
  });

  it("diasParaExpirar devuelve null cuando no hay fecha", () => {
    expect(diasParaExpirar(makeRuta({ proxima_expiracion: null }))).toBeNull();
  });

  it("umbral por defecto es 7 días", () => {
    expect(DIAS_POR_VENCER).toBe(7);
  });
});
