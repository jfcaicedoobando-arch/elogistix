/**
 * Tests puros de helpers de conversión cotización → embarque (feature 12.30.0).
 * Sin mocks: funciones síncronas sin side effects.
 */
import { describe, it, expect } from "vitest";
import {
  construirHijosPayload,
  construirCostosRows,
  parsearVentasJsonb,
} from "../embarquesHelpers";
import type { CotizacionRow } from "@/types/cotizacion";
import type { Tables } from "@/integrations/supabase/types";

const cot = {
  id: "cot-1",
  tipo_contenedor: "40HC",
  conceptos_venta: [],
  dimensiones_lcl: [],
  dimensiones_aereas: [],
} as unknown as CotizacionRow;

describe("construirHijosPayload", () => {
  it("reparte peso/volumen/piezas entre N contenedores; el último absorbe el residuo de piezas", () => {
    const out = construirHijosPayload("emb-1", cot, 3, {
      pesoTotal: 9000,
      volumenTotal: 60,
      piezasTotal: 10,
    });
    expect(out).toHaveLength(3);
    expect(out.map((h) => h.peso_kg)).toEqual([3000, 3000, 3000]);
    expect(out.map((h) => h.volumen_m3)).toEqual([20, 20, 20]);
    expect(out.map((h) => h.piezas)).toEqual([3, 3, 4]);
    expect(out.map((h) => h.orden)).toEqual([1, 2, 3]);
  });

  it("con 1 contenedor, asigna todo a ese hijo", () => {
    const out = construirHijosPayload("emb-1", cot, 1, {
      pesoTotal: 500,
      volumenTotal: 5,
      piezasTotal: 7,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      embarque_id: "emb-1",
      tipo_contenedor: "40HC",
      peso_kg: 500,
      volumen_m3: 5,
      piezas: 7,
      orden: 1,
    });
  });

  it("usa string vacío si tipo_contenedor es null", () => {
    const out = construirHijosPayload(
      "emb-1",
      { ...cot, tipo_contenedor: null } as CotizacionRow,
      1,
      { pesoTotal: 0, volumenTotal: 0, piezasTotal: 0 },
    );
    expect(out[0]?.tipo_contenedor).toBe("");
  });
});

describe("construirCostosRows", () => {
  const hijos = [
    { id: "h1" },
    { id: "h2" },
  ] as unknown as Tables<"embarque_contenedores">[];

  const costoBL = {
    cotizacion_id: "cot-1",
    descripcion: "BL Fee",
    cantidad: 1,
    costo_unitario: 100,
    moneda: "USD",
    proveedor: null,
    unidad_medida: "BL",
    aplica_iva: false,
  } as unknown as Tables<"cotizacion_costos">;

  const costoCont = { ...costoBL, descripcion: "THC", unidad_medida: "Contenedor" } as Tables<"cotizacion_costos">;

  it("costo BL → 1 fila con contenedor_id null", () => {
    const rows = construirCostosRows([costoBL], "emb-1", hijos);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.contenedor_id).toBeNull();
  });

  it("costo Contenedor con 2 hijos → 2 filas, una por hijo", () => {
    const rows = construirCostosRows([costoCont], "emb-1", hijos);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.contenedor_id)).toEqual(["h1", "h2"]);
  });

  it("mezcla BL + Contenedor → 1 + N filas", () => {
    const rows = construirCostosRows([costoBL, costoCont], "emb-1", hijos);
    expect(rows).toHaveLength(3); // 1 BL + 2 Contenedor
  });

  it("array vacío de costos → array vacío", () => {
    expect(construirCostosRows([], "emb-1", hijos)).toEqual([]);
  });

  it("unidad_medida nula → trata como Contenedor (default)", () => {
    const costoSinUM = { ...costoBL, unidad_medida: null } as Tables<"cotizacion_costos">;
    const rows = construirCostosRows([costoSinUM], "emb-1", hijos);
    expect(rows).toHaveLength(2); // se replica por hijo
  });
});

describe("parsearVentasJsonb", () => {
  it("filtra items sin descripción", () => {
    const out = parsearVentasJsonb(
      [
        { descripcion: "", cantidad: 1, precio_unitario: 100, total: 100 },
        { descripcion: "Flete", cantidad: 1, precio_unitario: 200, total: 200 },
      ],
      "emb-1",
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.descripcion).toBe("Flete");
  });

  it("normaliza moneda: USD se preserva, cualquier otra → MXN", () => {
    const out = parsearVentasJsonb(
      [
        { descripcion: "A", moneda: "USD", cantidad: 1, precio_unitario: 1, total: 1 },
        { descripcion: "B", moneda: "EUR", cantidad: 1, precio_unitario: 1, total: 1 },
        { descripcion: "C", moneda: undefined, cantidad: 1, precio_unitario: 1, total: 1 },
      ],
      "emb-1",
    );
    expect(out.map((v) => v.moneda)).toEqual(["USD", "MXN", "MXN"]);
  });

  it("ignora valores no-objeto (null, string, array)", () => {
    const out = parsearVentasJsonb([null, "x", [], { descripcion: "OK", total: 1 }], "emb-1");
    expect(out).toHaveLength(1);
    expect(out[0]?.descripcion).toBe("OK");
  });

  it("aplica defaults numéricos: cantidad 1, precio 0, total 0, aplica_iva false", () => {
    const out = parsearVentasJsonb([{ descripcion: "X" }], "emb-1");
    expect(out[0]).toMatchObject({
      embarque_id: "emb-1",
      descripcion: "X",
      cantidad: 1,
      precio_unitario: 0,
      total: 0,
      aplica_iva: false,
    });
  });

  it("array vacío → array vacío", () => {
    expect(parsearVentasJsonb([], "emb-1")).toEqual([]);
  });
});
