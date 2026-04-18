import { describe, it, expect } from "vitest";
import {
  parseConteoPorEstado,
  parseArribosEsteMes,
  parseResumenMesSiguiente,
  parseCargasPorCliente,
  combinarActivos,
  EMPTY_CONTEO,
  EMPTY_ARRIBOS,
  EMPTY_RESUMEN,
  type EmbarqueConEstado,
} from "@/lib/parsers/dashboard";

const baseEmb = (id: string): EmbarqueConEstado => ({
  id,
  expediente: `EXP-${id}`,
  cliente_nombre: "Cliente",
  modo: "Marítimo",
  tipo: "Importación",
  estado: "Confirmado",
  estadoReal: "Confirmado",
  etd: null,
  eta: null,
  operador: "op@test.mx",
  created_at: "2026-04-01T00:00:00Z",
});

describe("dashboardParsers", () => {
  describe("parseConteoPorEstado", () => {
    it("retorna conteo vacío para stats null/undefined", () => {
      expect(parseConteoPorEstado(null)).toEqual(EMPTY_CONTEO);
      expect(parseConteoPorEstado(undefined)).toEqual(EMPTY_CONTEO);
      expect(parseConteoPorEstado({})).toEqual(EMPTY_CONTEO);
    });

    it("parsea correctamente todos los estados", () => {
      const result = parseConteoPorEstado({
        conteoPorEstado: { Confirmado: 5, "En Tránsito": 3, Arribo: 1, "En Aduana": 2, Entregado: 7 },
      });
      expect(result).toEqual({ Confirmado: 5, "En Tránsito": 3, Arribo: 1, "En Aduana": 2, Entregado: 7 });
    });

    it("usa 0 como default para estados ausentes", () => {
      const result = parseConteoPorEstado({ conteoPorEstado: { Confirmado: 5 } });
      expect(result.Confirmado).toBe(5);
      expect(result["En Tránsito"]).toBe(0);
      expect(result.Entregado).toBe(0);
    });

    it("convierte strings numéricos correctamente", () => {
      const result = parseConteoPorEstado({ conteoPorEstado: { Confirmado: "10" } });
      expect(result.Confirmado).toBe(10);
    });
  });

  describe("parseArribosEsteMes", () => {
    it("retorna estructura vacía para stats inválidas", () => {
      expect(parseArribosEsteMes(null)).toEqual(EMPTY_ARRIBOS);
      expect(parseArribosEsteMes({})).toEqual(EMPTY_ARRIBOS);
    });

    it("parsea correctamente todos los campos", () => {
      const result = parseArribosEsteMes({
        arribosEsteMes: { total: 10, yaLlegaron: 3, enCamino: 7, profitUSD: 12500.5 },
      });
      expect(result).toEqual({ total: 10, yaLlegaron: 3, enCamino: 7, profitUSD: 12500.5 });
    });
  });

  describe("parseResumenMesSiguiente", () => {
    it("retorna resumen vacío para stats inválidas", () => {
      expect(parseResumenMesSiguiente(null)).toEqual(EMPTY_RESUMEN);
    });

    it("parsea todos los campos incluyendo el nombre del mes", () => {
      const result = parseResumenMesSiguiente({
        resumenMesSiguiente: {
          totalEmbarques: 5,
          ventaUSD: 1000,
          costoUSD: 600,
          profitUSD: 400,
          facturados: 3,
          nombreMes: "Mayo",
        },
      });
      expect(result.nombreMes).toBe("Mayo");
      expect(result.profitUSD).toBe(400);
      expect(result.totalEmbarques).toBe(5);
    });
  });

  describe("parseCargasPorCliente", () => {
    it("retorna array vacío sin datos", () => {
      expect(parseCargasPorCliente(null)).toEqual([]);
      expect(parseCargasPorCliente({})).toEqual([]);
    });

    it("retorna el array tal cual cuando existe", () => {
      const cargas = [{ clienteId: "1", clienteNombre: "X", total: 5, desglose: {} as never }];
      expect(parseCargasPorCliente({ cargasPorCliente: cargas })).toEqual(cargas);
    });
  });

  describe("combinarActivos", () => {
    it("retorna array vacío para entrada vacía", () => {
      expect(combinarActivos()).toEqual([]);
      expect(combinarActivos([], [])).toEqual([]);
    });

    it("deduplica por id manteniendo el primer match", () => {
      const a = baseEmb("1");
      const b = baseEmb("2");
      const aDup = { ...baseEmb("1"), expediente: "DUPLICADO" };
      const result = combinarActivos([a, b], [aDup]);
      expect(result).toHaveLength(2);
      expect(result[0].expediente).toBe("EXP-1");
    });

    it("preserva el orden de inserción de las listas", () => {
      const result = combinarActivos([baseEmb("3")], [baseEmb("1"), baseEmb("2")]);
      expect(result.map(e => e.id)).toEqual(["3", "1", "2"]);
    });
  });
});
