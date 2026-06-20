import { describe, it, expect } from "vitest";
import {
  parseConteoPorEstado,
  parseArribosEsteMes,
  parseResumenMesSiguiente,
  parseCargasActivasTotal,
  parseCargasPorCliente,
  combinarActivos,
  EMPTY_CONTEO,
  EMPTY_ARRIBOS,
  EMPTY_RESUMEN,
} from "@/lib/parsers/dashboard";
import type { DashboardStats, EmbarqueConEstado } from "@/lib/parsers/dashboard";

const makeEstado = (id: string): EmbarqueConEstado => ({
  id,
  expediente: `EXP-${id}`,
  cliente_nombre: "Cliente",
  modo: "Maritimo",
  tipo: "FCL",
  estado: "Confirmado",
  estadoReal: "Confirmado",
  etd: null,
  eta: null,
  operador: "op@empresa.com",
  created_at: "2024-01-01",
});

describe("dashboard | parseConteoPorEstado", () => {
  it("retorna EMPTY_CONTEO para stats null", () => {
    expect(parseConteoPorEstado(null)).toEqual(EMPTY_CONTEO);
  });

  it("retorna EMPTY_CONTEO cuando falta conteoPorEstado", () => {
    expect(parseConteoPorEstado({} as DashboardStats)).toEqual(EMPTY_CONTEO);
  });

  it("parsea valores correctamente", () => {
    const stats: DashboardStats = {
      conteoPorEstado: { Confirmado: 5, "En Tránsito": 3, Arribo: 2, "En Aduana": 1, Entregado: 4 },
    };
    const result = parseConteoPorEstado(stats);
    expect(result.Confirmado).toBe(5);
    expect(result["En Tránsito"]).toBe(3);
    expect(result.Arribo).toBe(2);
    expect(result["En Aduana"]).toBe(1);
    expect(result.Entregado).toBe(4);
  });

  it("usa 0 para claves ausentes", () => {
    const stats: DashboardStats = { conteoPorEstado: { Confirmado: 10 } };
    const result = parseConteoPorEstado(stats);
    expect(result["En Tránsito"]).toBe(0);
  });

  it("convierte strings numéricos a number", () => {
    const stats: DashboardStats = { conteoPorEstado: { Confirmado: "7" } };
    const result = parseConteoPorEstado(stats);
    expect(result.Confirmado).toBe(7);
  });
});

describe("dashboard | parseArribosEsteMes", () => {
  it("retorna EMPTY_ARRIBOS para stats null", () => {
    expect(parseArribosEsteMes(null)).toEqual(EMPTY_ARRIBOS);
  });

  it("retorna EMPTY_ARRIBOS para payload string inválido", () => {
    const stats: DashboardStats = { arribosEsteMes: "invalido" };
    expect(parseArribosEsteMes(stats)).toEqual(EMPTY_ARRIBOS);
  });

  it("parsea un payload válido correctamente", () => {
    const payload = {
      total: 10, yaLlegaron: 4, enCamino: 6, profitUSD: 500,
      ventaMXN: 1000, costoMXN: 800, profitMXN: 200,
      ventaMxnFromUsd: 0, costoMxnFromUsd: 0,
      ventaMxnFromEur: 0, costoMxnFromEur: 0,
      ventaMxnNative: 0, costoMxnNative: 0,
    };
    const stats: DashboardStats = { arribosEsteMes: payload };
    const result = parseArribosEsteMes(stats);
    expect(result.total).toBe(10);
    expect(result.profitUSD).toBe(500);
  });

  it("retorna EMPTY_ARRIBOS cuando stats es undefined", () => {
    expect(parseArribosEsteMes(undefined)).toEqual(EMPTY_ARRIBOS);
  });
});

describe("dashboard | parseResumenMesSiguiente", () => {
  it("retorna EMPTY_RESUMEN para stats null", () => {
    expect(parseResumenMesSiguiente(null)).toEqual(EMPTY_RESUMEN);
  });

  it("retorna EMPTY_RESUMEN cuando resumenMesSiguiente es null", () => {
    expect(parseResumenMesSiguiente({ resumenMesSiguiente: null })).toEqual(EMPTY_RESUMEN);
  });

  it("retorna EMPTY_RESUMEN para stats undefined", () => {
    expect(parseResumenMesSiguiente(undefined)).toEqual(EMPTY_RESUMEN);
  });

  it("retorna EMPTY_RESUMEN para payload inválido (string)", () => {
    expect(parseResumenMesSiguiente({ resumenMesSiguiente: "nope" })).toEqual(EMPTY_RESUMEN);
  });

  it("parsea un payload válido", () => {
    const payload = {
      totalEmbarques: 5, ventaUSD: 10000, costoUSD: 7000, profitUSD: 3000,
      ventaMXN: 100000, costoMXN: 70000, profitMXN: 30000,
      facturados: 2, nombreMes: "Febrero",
    };
    const result = parseResumenMesSiguiente({ resumenMesSiguiente: payload });
    expect(result.totalEmbarques).toBe(5);
    expect(result.nombreMes).toBe("Febrero");
  });
});

describe("dashboard | parseCargasActivasTotal", () => {
  it("retorna 0 para stats null", () => {
    expect(parseCargasActivasTotal(null)).toBe(0);
  });

  it("retorna el número directamente", () => {
    expect(parseCargasActivasTotal({ cargasActivasTotal: 42 })).toBe(42);
  });

  it("convierte string numérico a number", () => {
    expect(parseCargasActivasTotal({ cargasActivasTotal: "15" })).toBe(15);
  });

  it("retorna 0 cuando la clave está ausente", () => {
    expect(parseCargasActivasTotal({})).toBe(0);
  });
});

describe("dashboard | parseCargasPorCliente", () => {
  it("retorna [] para stats null", () => {
    expect(parseCargasPorCliente(null)).toEqual([]);
  });

  it("retorna [] cuando no hay cargasPorCliente", () => {
    expect(parseCargasPorCliente({})).toEqual([]);
  });

  it("retorna [] cuando cargasPorCliente no es array", () => {
    expect(parseCargasPorCliente({ cargasPorCliente: "nope" })).toEqual([]);
  });
});

describe("dashboard | combinarActivos", () => {
  it("retorna vacío con listas vacías", () => {
    expect(combinarActivos([], [])).toEqual([]);
  });

  it("combina dos listas sin duplicados", () => {
    const a = [makeEstado("1"), makeEstado("2")];
    const b = [makeEstado("3")];
    expect(combinarActivos(a, b)).toHaveLength(3);
  });

  it("deduplica embarques con el mismo id", () => {
    const a = [makeEstado("1"), makeEstado("2")];
    const b = [makeEstado("2"), makeEstado("3")];
    expect(combinarActivos(a, b)).toHaveLength(3);
  });

  it("preserva el orden de aparición (primero en llegar, primero en lista)", () => {
    const a = [makeEstado("X")];
    const b = [makeEstado("X")];
    const result = combinarActivos(a, b);
    expect(result[0].id).toBe("X");
    expect(result).toHaveLength(1);
  });

  it("acepta más de dos listas", () => {
    const result = combinarActivos([makeEstado("A")], [makeEstado("B")], [makeEstado("C")]);
    expect(result).toHaveLength(3);
  });

  it("retorna vacío cuando se pasa una sola lista vacía", () => {
    expect(combinarActivos([])).toHaveLength(0);
  });
});
