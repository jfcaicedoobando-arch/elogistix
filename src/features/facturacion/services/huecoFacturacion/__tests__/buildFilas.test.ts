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
import { calcularExclusionesPorProformaHistorica } from "@/features/facturacion/services/huecoFacturacion";
import type { ConceptoVentaDetalle } from "@/features/facturacion/services/huecoFacturacion/fetchSources";

describe("calcularExclusionesPorProformaHistorica", () => {
  const mk = (o: Partial<ConceptoVentaDetalle> & { embarque_id: string }): ConceptoVentaDetalle => ({
    estado_facturacion: "en_proforma",
    proforma_id: "p1",
    proforma_estado: "facturada",
    ...o,
  });

  it("excluye embarque cuando todos los conceptos están en proformas facturadas", () => {
    const set = calcularExclusionesPorProformaHistorica([
      mk({ embarque_id: "e1" }),
      mk({ embarque_id: "e1" }),
    ]);
    expect(set.has("e1")).toBe(true);
  });

  it("no excluye si al menos un concepto sigue pendiente", () => {
    const set = calcularExclusionesPorProformaHistorica([
      mk({ embarque_id: "e1" }),
      mk({ embarque_id: "e1", estado_facturacion: "pendiente", proforma_id: null, proforma_estado: null }),
    ]);
    expect(set.has("e1")).toBe(false);
  });

  it("no excluye si la proforma padre no está facturada", () => {
    const set = calcularExclusionesPorProformaHistorica([
      mk({ embarque_id: "e1", proforma_estado: "pendiente" }),
    ]);
    expect(set.has("e1")).toBe(false);
  });

  it("no excluye si no hay conceptos", () => {
    const set = calcularExclusionesPorProformaHistorica([]);
    expect(set.size).toBe(0);
  });

  it("maneja múltiples embarques de forma independiente", () => {
    const set = calcularExclusionesPorProformaHistorica([
      mk({ embarque_id: "e1" }),
      mk({ embarque_id: "e2", proforma_estado: "pendiente" }),
    ]);
    expect(set.has("e1")).toBe(true);
    expect(set.has("e2")).toBe(false);
  });

  it("v13.301.47 — excluye legacy: todos los conceptos en estado_facturacion='facturado' sin proforma", () => {
    const set = calcularExclusionesPorProformaHistorica([
      { embarque_id: "e1", estado_facturacion: "facturado", proforma_id: null, proforma_estado: null },
      { embarque_id: "e1", estado_facturacion: "facturado", proforma_id: "p1", proforma_estado: "facturada" },
    ]);
    expect(set.has("e1")).toBe(true);
  });

  it("v13.301.47 — no excluye legacy si algún concepto sigue pendiente aunque otros estén facturados", () => {
    const set = calcularExclusionesPorProformaHistorica([
      { embarque_id: "e1", estado_facturacion: "facturado", proforma_id: null, proforma_estado: null },
      { embarque_id: "e1", estado_facturacion: "pendiente", proforma_id: null, proforma_estado: null },
    ]);
    expect(set.has("e1")).toBe(false);
  });
});

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

  it("devuelve null cuando eta falta", () => {
    expect(construirFilaHueco({ ...baseE, eta: null as unknown as string }, new Map(), new Date())).toBeNull();
  });

  it("calcula diasDesdeEta respecto a hoy", () => {
    const r = construirFilaHueco(baseE as never, new Map(), new Date("2026-06-25T00:00:00"));
    expect(r?.diasDesdeEta).toBe(5);
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

  it("Ola 9 · M5: sin tipo_cambio no asume 1:1, marca sin_tc y deja MXN en 0", () => {
    const map = new Map<string, { monto: number; moneda: string }[]>();
    map.set("e1", [{ monto: 50, moneda: "USD" }]);
    const r = construirFilaHueco(
      { ...baseE, tipo_cambio_usd: null, tipo_cambio_eur: null } as never,
      map,
      new Date("2026-06-12T00:00:00"),
    );
    expect(r?.ventaMxn).toBe(0);
    expect(r?.sin_tc).toBe(true);
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
