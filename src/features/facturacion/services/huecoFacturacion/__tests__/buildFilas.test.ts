import { describe, it, expect, vi } from "vitest";

vi.mock("@/features/facturacion/domain/proyeccionFacturacion", () => ({
  sumarConceptosEnMxn: vi.fn((rows: Array<{ monto: number; moneda: string }>, tcUsd: number, tcEur: number) =>
    rows.reduce((acc, r) => acc + r.monto * (r.moneda === "USD" ? tcUsd : r.moneda === "EUR" ? tcEur : 1), 0),
  ),
  sumarConceptosEnUsd: vi.fn((rows: Array<{ monto: number; moneda: string }>, tcUsd: number) =>
    rows.reduce((acc, r) => acc + r.monto / (r.moneda === "USD" ? 1 : tcUsd), 0),
  ),
}));

import {
  diasDesde,
  indexarVentas,
  construirFilaHueco,
} from "@/features/facturacion/services/huecoFacturacion/buildFilas";

describe("diasDesde", () => {
  it("devuelve 0 cuando fecha = hoy", () => {
    const hoy = new Date("2026-06-12T00:00:00");
    expect(diasDesde("2026-06-12", hoy)).toBe(0);
  });

  it("devuelve días positivos para fecha pasada", () => {
    const hoy = new Date("2026-06-12T00:00:00");
    expect(diasDesde("2026-06-01", hoy)).toBe(11);
  });

  it("devuelve negativo para fecha futura", () => {
    const hoy = new Date("2026-06-12T00:00:00");
    expect(diasDesde("2026-06-20", hoy)).toBe(-8);
  });

  it("usa floor para fracciones", () => {
    const hoy = new Date("2026-06-12T12:30:00");
    expect(diasDesde("2026-06-11", hoy)).toBe(1);
  });
});

describe("indexarVentas", () => {
  it("agrupa por embarque_id", () => {
    const m = indexarVentas([
      { embarque_id: "e1", total: 100, moneda: "MXN" },
      { embarque_id: "e1", total: 50, moneda: "USD" },
      { embarque_id: "e2", total: 200, moneda: "MXN" },
    ]);
    expect(m.get("e1")).toHaveLength(2);
    expect(m.get("e2")).toHaveLength(1);
  });

  it("convierte total null a 0", () => {
    const m = indexarVentas([{ embarque_id: "e1", total: null, moneda: "MXN" }]);
    expect(m.get("e1")![0].monto).toBe(0);
  });

  it("convierte moneda null a MXN", () => {
    const m = indexarVentas([{ embarque_id: "e1", total: 10, moneda: null }]);
    expect(m.get("e1")![0].moneda).toBe("MXN");
  });

  it("devuelve Map vacío para input vacío", () => {
    expect(indexarVentas([]).size).toBe(0);
  });
});

describe("construirFilaHueco", () => {
  const baseE = {
    id: "e1",
    expediente: "EXP-001",
    cliente_nombre: "ACME",
    operador: "op",
    etd: "2026-06-01",
    eta: "2026-06-20",
    bl_master: "BLM",
    bl_house: "BLH",
    tipo_cambio_usd: 20,
    tipo_cambio_eur: 22,
  };

  it("devuelve null cuando etd falta", () => {
    expect(construirFilaHueco({ ...baseE, etd: null as unknown as string }, new Map(), new Date())).toBeNull();
  });

  it("calcula diasDesdeEtd respecto a hoy", () => {
    const r = construirFilaHueco(baseE as never, new Map(), new Date("2026-06-12T00:00:00"));
    expect(r?.diasDesdeEtd).toBe(11);
  });

  it("ventaMxn=0 cuando no hay ventas en el map", () => {
    const r = construirFilaHueco(baseE as never, new Map(), new Date("2026-06-12T00:00:00"));
    expect(r?.ventaMxn).toBe(0);
    expect(r?.ventaUsd).toBe(0);
  });

  it("suma ventas en MXN y USD usando los TC", () => {
    const map = new Map<string, { monto: number; moneda: string }[]>();
    map.set("e1", [
      { monto: 100, moneda: "MXN" },
      { monto: 10, moneda: "USD" },
    ]);
    const r = construirFilaHueco(baseE as never, map, new Date("2026-06-12T00:00:00"));
    expect(r?.ventaMxn).toBe(100 + 10 * 20);
    expect(r?.ventaUsd).toBe(100 / 20 + 10);
  });

  it("usa default 1 para tipo_cambio null", () => {
    const map = new Map<string, { monto: number; moneda: string }[]>();
    map.set("e1", [{ monto: 50, moneda: "USD" }]);
    const r = construirFilaHueco(
      { ...baseE, tipo_cambio_usd: null, tipo_cambio_eur: null } as never,
      map,
      new Date("2026-06-12T00:00:00"),
    );
    expect(r?.ventaMxn).toBe(50);
  });

  it("normaliza cliente_nombre/operador null a ''", () => {
    const r = construirFilaHueco(
      { ...baseE, cliente_nombre: null, operador: null, expediente: null } as never,
      new Map(),
      new Date("2026-06-12T00:00:00"),
    );
    expect(r?.cliente_nombre).toBe("");
    expect(r?.operador).toBe("");
    expect(r?.expediente).toBe("");
  });

  it("preserva bl_master y bl_house", () => {
    const r = construirFilaHueco(baseE as never, new Map(), new Date("2026-06-12T00:00:00"));
    expect(r?.bl_master).toBe("BLM");
    expect(r?.bl_house).toBe("BLH");
  });

  it("bl_master null preservado como null", () => {
    const r = construirFilaHueco(
      { ...baseE, bl_master: null, bl_house: null } as never,
      new Map(),
      new Date("2026-06-12T00:00:00"),
    );
    expect(r?.bl_master).toBeNull();
    expect(r?.bl_house).toBeNull();
  });
});
