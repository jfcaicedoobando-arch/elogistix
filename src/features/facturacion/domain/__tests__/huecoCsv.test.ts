import { describe, it, expect } from "vitest";
import { buildHuecoCsvFilename, buildHuecoCsvRows, HUECO_CSV_HEADERS } from "../huecoCsv";
import type { FilaHueco } from "@/features/facturacion/services";

const fila: FilaHueco = {
  embarque_id: "e1",
  expediente: "EXP-1",
  cliente_nombre: "ACME",
  operador: "OP",
  etd: "2026-05-01",
  eta: "2026-05-15",
  bl_master: "BLM",
  bl_house: null,
  diasDesdeEta: 10,
  ventaUsd: 123.456,
  ventaMxn: 2469.12,
  sin_tc: false,
};

describe("buildHuecoCsvFilename", () => {
  it("incluye fecha ISO YYYY-MM-DD", () => {
    expect(buildHuecoCsvFilename(new Date("2026-06-15T12:00:00Z"))).toBe(
      "hueco_facturacion_2026-06-15.csv",
    );
  });
});

describe("buildHuecoCsvRows", () => {
  it("redondea ventas a 2 decimales y normaliza nulos", () => {
    const [row] = buildHuecoCsvRows([fila]);
    expect(row.venta_usd).toBe("123.46");
    expect(row.venta_mxn).toBe("2469.12");
    expect(row.bl_house).toBe("");
  });

  it("formatea ETA/ETD con formatDate (DD/MM/YYYY MX)", () => {
    const [row] = buildHuecoCsvRows([fila]);
    expect(String(row.etd)).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("devuelve etd/eta vacío cuando faltan", () => {
    const [row] = buildHuecoCsvRows([{ ...fila, etd: null, eta: "" }]);
    expect(row.etd).toBe("");
    expect(row.eta).toBe("");
  });
});

describe("HUECO_CSV_HEADERS", () => {
  it("incluye las 10 columnas esperadas", () => {
    expect(HUECO_CSV_HEADERS.map((h) => h.key)).toEqual([
      "expediente", "cliente", "operador", "etd", "eta",
      "bl_master", "bl_house", "dias_sin_facturar", "venta_usd", "venta_mxn",
    ]);
  });
});
