/**
 * Tests del builder de filas CSV para "Proyección de Facturación".
 * Verifica encabezados, formato de números con 2 decimales, margen con 1
 * decimal, formato de fecha y comportamiento ante ETA null.
 */
import { describe, it, expect } from "vitest";
import {
  buildProyeccionCsvFilename,
  buildProyeccionCsvRows,
  PROYECCION_CSV_HEADERS,
} from "../proyeccionCsv";
import type { GrupoProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion/types";

const grupo = (over: Partial<GrupoProyeccion> = {}): GrupoProyeccion => ({
  expediente: "LCM-0001",
  sinTc: false,
  cliente_nombre: "ACME, S.A. de C.V.",
  operador: "Ana",
  eta: "2026-07-15",
  contenedores: ["CONT001", "CONT002"],
  totalContenedores: 2,
  ventaMxn: 100000,
  ventaUsd: 5000,
  costoMxn: 70000,
  costoUsd: 3500,
  profitMxn: 30000,
  profitUsd: 1500,
  margenPct: 30,
  estado: "Pendiente",
  embarqueIds: ["e1"],
  ...over,
});

describe("buildProyeccionCsvFilename", () => {
  it("usa el mesKey en el nombre del archivo", () => {
    expect(buildProyeccionCsvFilename("2026-06")).toBe("proyeccion_2026-06.csv");
  });
});

describe("PROYECCION_CSV_HEADERS", () => {
  it("expone las 13 columnas esperadas", () => {
    expect(PROYECCION_CSV_HEADERS).toHaveLength(13);
    expect(PROYECCION_CSV_HEADERS.map((h) => h.key)).toEqual([
      "expediente", "cliente", "operador", "eta", "contenedores",
      "venta_usd", "venta_mxn", "costo_usd", "costo_mxn",
      "profit_usd", "profit_mxn", "margen", "estado",
    ]);
  });
});

describe("buildProyeccionCsvRows", () => {
  it("mapea los campos con el formato esperado", () => {
    const rows = buildProyeccionCsvRows([grupo()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      expediente: "LCM-0001",
      cliente: "ACME, S.A. de C.V.",
      operador: "Ana",
      contenedores: 2,
      venta_usd: "5000.00",
      venta_mxn: "100000.00",
      costo_usd: "3500.00",
      costo_mxn: "70000.00",
      profit_usd: "1500.00",
      profit_mxn: "30000.00",
      margen: "30.0",
      estado: "Pendiente",
    });
    expect(rows[0].eta).toBeTruthy();
  });

  it("retorna ETA vacía cuando el grupo no tiene fecha", () => {
    const rows = buildProyeccionCsvRows([grupo({ eta: null })]);
    expect(rows[0].eta).toBe("");
  });

  it("respeta el orden de los grupos de entrada", () => {
    const rows = buildProyeccionCsvRows([
      grupo({ expediente: "A" }),
      grupo({ expediente: "B" }),
      grupo({ expediente: "C" }),
    ]);
    expect(rows.map((r) => r.expediente)).toEqual(["A", "B", "C"]);
  });

  it("retorna arreglo vacío para input vacío", () => {
    expect(buildProyeccionCsvRows([])).toEqual([]);
  });

  it("formatea margen y montos con la precisión declarada incluso con decimales largos", () => {
    const rows = buildProyeccionCsvRows([
      grupo({ ventaMxn: 1234.5678, profitMxn: 0.115, margenPct: 12.349 }),
    ]);
    expect(rows[0].venta_mxn).toBe("1234.57");
    expect(rows[0].margen).toBe("12.3");
  });
});
