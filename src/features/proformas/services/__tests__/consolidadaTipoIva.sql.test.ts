/**
 * IVA "No objeto de impuesto" (SAT ObjetoImp = 01) en proformas consolidadas.
 *
 * Antes, `consolidar_proformas` agrupaba por descripción/precio/moneda/
 * aplica_iva/tasa: dos líneas idénticas salvo el tratamiento fiscal
 * ('no_objeto', 'exento', 'tasa_0') se fusionaban en una sola y el tratamiento
 * se perdía. La migración preparada:
 *
 *  1. selecciona y guarda `tipo_iva` en `proforma_conceptos_consolidados`,
 *  2. lo agrega al GROUP BY (líneas separadas por tratamiento),
 *  3. recalcula el IVA por tipo (0 para no objeto / exento / tasa 0),
 *  4. lo conserva al convertir consolidada → factura (ObjetoImp 01 sobrevive).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { objetoImpDeTipoIva } from "@/lib/financial/tipoIvaSat";

const ROOT = process.cwd();
const MIGRACION = join(
  ROOT,
  "supabase/migrations/20260918000100_iva_no_objeto_sat01.sql",
);
const migracion = readFileSync(MIGRACION, "utf8");

/** Cuerpo de una función dentro del SQL de la migración. */
function cuerpo(sql: string, nombre: string): string {
  const inicio = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nombre}(`);
  expect(inicio, `no se encontró ${nombre} en la migración`).toBeGreaterThan(-1);
  const desde = sql.slice(inicio);
  return desde.slice(0, desde.indexOf("$function$;"));
}

/** Réplica en TS de las reglas del INSERT ... GROUP BY de la RPC. */
interface ConceptoVenta {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  moneda: "MXN" | "USD";
  aplicaIva: boolean;
  tasaIvaAplicada: number | null;
  tipoIva: string | null;
}

const SIN_TRASLADO = ["no_objeto", "exento", "tasa_0"];

function tasaEfectiva(cv: ConceptoVenta, tasaGlobal: number): number {
  if (cv.tipoIva && SIN_TRASLADO.includes(cv.tipoIva)) return 0;
  return cv.tasaIvaAplicada ?? (cv.aplicaIva ? tasaGlobal : 0);
}

function consolidar(conceptos: ConceptoVenta[], tasaGlobal: number) {
  const lineas = new Map<
    string,
    { tipoIva: string | null; total: number; iva: number; tasa: number | null }
  >();
  for (const cv of conceptos) {
    const tasaLegacy = cv.tasaIvaAplicada ?? (cv.aplicaIva ? tasaGlobal : 0);
    const clave = [
      cv.descripcion,
      cv.precioUnitario,
      cv.moneda,
      cv.aplicaIva,
      cv.tipoIva ?? "",
      tasaLegacy,
    ].join("|");
    const total = Number((cv.cantidad * cv.precioUnitario).toFixed(2));
    const previa = lineas.get(clave);
    const acumulado = (previa?.total ?? 0) + total;
    lineas.set(clave, {
      tipoIva: cv.tipoIva,
      total: acumulado,
      iva: Number((acumulado * tasaEfectiva(cv, tasaGlobal)).toFixed(2)),
      tasa: cv.tipoIva === "no_objeto" ? null : tasaEfectiva(cv, tasaGlobal),
    });
  }
  return [...lineas.values()];
}

describe("consolidar_proformas · tratamiento fiscal explícito", () => {
  it("guarda tipo_iva y lo agrega al GROUP BY", () => {
    const fn = cuerpo(migracion, "consolidar_proformas");
    const insert = fn.slice(fn.indexOf("INSERT INTO public.proforma_conceptos_consolidados"));
    expect(insert).toContain("tasa_iva_aplicada, tipo_iva");
    const groupBy = insert.slice(insert.indexOf("GROUP BY"));
    expect(groupBy).toContain("cv.tipo_iva");
  });

  it("no objeto, exento y tasa 0 no llevan traslado de IVA", () => {
    const fn = cuerpo(migracion, "consolidar_proformas");
    expect(fn).toContain("cv.tipo_iva IN ('no_objeto', 'exento', 'tasa_0') THEN 0");
    expect(fn).toContain("cv.tipo_iva = 'no_objeto' THEN NULL");
  });

  it("conceptos idénticos salvo el tipo quedan en líneas distintas", () => {
    const base = {
      descripcion: "Maniobras en puerto",
      cantidad: 1,
      precioUnitario: 1000,
      moneda: "MXN" as const,
      aplicaIva: false,
      tasaIvaAplicada: 0,
    };
    const lineas = consolidar(
      [
        { ...base, tipoIva: "no_objeto" },
        { ...base, tipoIva: "exento" },
        { ...base, tipoIva: "tasa_0" },
      ],
      0.16,
    );
    expect(lineas).toHaveLength(3);
    expect(lineas.map((l) => l.tipoIva)).toEqual(["no_objeto", "exento", "tasa_0"]);
    expect(lineas.every((l) => l.iva === 0)).toBe(true);
    expect(lineas.find((l) => l.tipoIva === "no_objeto")?.tasa).toBeNull();
  });

  it("las líneas gravadas sí se fusionan y conservan su IVA", () => {
    const base = {
      descripcion: "Flete marítimo",
      precioUnitario: 500,
      moneda: "MXN" as const,
      aplicaIva: true,
      tasaIvaAplicada: 0.16,
      tipoIva: "gravado_16",
    };
    const lineas = consolidar([{ ...base, cantidad: 1 }, { ...base, cantidad: 3 }], 0.16);
    expect(lineas).toHaveLength(1);
    expect(lineas[0].total).toBe(2000);
    expect(lineas[0].iva).toBe(320);
  });

  it("ObjetoImp 01 sobrevive de la consolidada a la factura", () => {
    const fn = cuerpo(migracion, "_convertir_proformas_insertar_conceptos");
    const consolidada = fn.slice(0, fn.indexOf("\n  ELSE"));
    expect(consolidada).toContain("pcc.tipo_iva IS NOT NULL THEN pcc.tipo_iva");
    expect(consolidada).toContain("pcc.tipo_iva = 'no_objeto' THEN NULL");
    expect(objetoImpDeTipoIva("no_objeto")).toBe("01");
    expect(objetoImpDeTipoIva("exento")).toBe("02");
    expect(objetoImpDeTipoIva("tasa_0")).toBe("02");
  });
});
