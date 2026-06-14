/**
 * Test de integración cross-módulo: Cotización → Embarque (datos puros).
 *
 * Sin tocar Supabase, ejercita la composición real de las 3 funciones
 * que transforman una cotización (con N contenedores + costos BL/Contenedor
 * + conceptos_venta jsonb) en los inserts que recibirá la BD para
 * `embarque_contenedores`, `conceptos_costo` y `conceptos_venta`.
 *
 * Cubre el flujo B.3.1 del plan de auditoría de tests.
 */
import { describe, it, expect } from "vitest";
import {
  construirHijosPayload,
  construirCostosRows,
  parsearVentasJsonb,
} from "@/features/cotizacion/services/conversiones/embarquesHelpers";
import type { CotizacionRow } from "@/features/cotizacion/types";
import type { Tables } from "@/integrations/supabase/types";

const cot = (over: Partial<CotizacionRow> = {}): CotizacionRow => ({
  id: "cot-1", cliente_id: "cli-1", cliente_nombre: "ACME",
  tipo_documento: "real", modo: "Marítimo", tipo: "Importación",
  incoterm: "FOB", descripcion_mercancia: "carga",
  peso_kg: 1000, volumen_m3: 30, piezas: 101,
  operador: "Op", tipo_carga: "FCL", tipo_contenedor: "40HC",
  num_contenedores: 3, conceptos_venta: [],
  // SAFE-CAST: shape mínimo de CotizacionRow para el test de transformación
  ...over,
} as unknown as CotizacionRow);

const costo = (over: Partial<Tables<"cotizacion_costos">> = {}): Tables<"cotizacion_costos"> => ({
  id: "k-x", cotizacion_id: "cot-1", concepto: "Flete",
  costo_unitario: 100, moneda: "USD", proveedor: "Naviera X",
  unidad_medida: "Contenedor",
  // SAFE-CAST: campos mínimos requeridos por el helper
  ...over,
} as unknown as Tables<"cotizacion_costos">);

describe("Integración Cotización → Embarque (helpers puros)", () => {
  describe("[integration] construirHijosPayload", () => {
    it("reparte peso/volumen equitativamente y reserva piezas residuales al último", () => {
      const hijos = construirHijosPayload("emb-1", cot(), 3, {
        pesoTotal: 1000, volumenTotal: 30, piezasTotal: 101,
      });
      expect(hijos).toHaveLength(3);
      // peso/volumen homogéneos
      for (const h of hijos) {
        expect(h.peso_kg).toBeCloseTo(333.33, 1);
        expect(h.volumen_m3).toBeCloseTo(10, 5);
        expect(h.embarque_id).toBe("emb-1");
        expect(h.tipo_contenedor).toBe("40HC");
      }
      // piezas: 33 + 33 + 35 (residual al último)
      expect(hijos.map((h) => h.piezas)).toEqual([33, 33, 35]);
      // orden 1..N
      expect(hijos.map((h) => h.orden)).toEqual([1, 2, 3]);
    });

    it("conserva total de piezas (suma exacta = piezasTotal)", () => {
      const hijos = construirHijosPayload("emb-1", cot(), 4, {
        pesoTotal: 100, volumenTotal: 10, piezasTotal: 50,
      });
      const total = hijos.reduce((s, h) => s + (h.piezas ?? 0), 0);
      expect(total).toBe(50);
    });

    it("con 1 contenedor pone todo el peso/piezas en un solo hijo", () => {
      const hijos = construirHijosPayload("emb-1", cot(), 1, {
        pesoTotal: 800, volumenTotal: 20, piezasTotal: 17,
      });
      expect(hijos).toHaveLength(1);
      expect(hijos[0].piezas).toBe(17);
      expect(hijos[0].peso_kg).toBe(800);
    });
  });

  describe("construirCostosRows", () => {
    const hijos = [
      { id: "h1", orden: 1 },
      { id: "h2", orden: 2 },
      // SAFE-CAST: el helper sólo lee `id`
    ] as unknown as Tables<"embarque_contenedores">[];

    it("costo BL se inserta UNA vez con contenedor_id=null", () => {
      const rows = construirCostosRows(
        [costo({ unidad_medida: "BL", concepto: "Documentación", costo_unitario: 50 })],
        "emb-1", hijos,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].contenedor_id).toBeNull();
      expect(rows[0].concepto).toBe("Documentación");
      expect(rows[0].monto).toBe(50);
    });

    it("costo Contenedor se replica por cada hijo con contenedor_id correspondiente", () => {
      const rows = construirCostosRows(
        [costo({ unidad_medida: "Contenedor", concepto: "THC" })],
        "emb-1", hijos,
      );
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.contenedor_id)).toEqual(["h1", "h2"]);
    });

    it("mezcla BL + Contenedor produce 1 + N filas en orden", () => {
      const rows = construirCostosRows(
        [
          costo({ id: "k1", unidad_medida: "BL", concepto: "B/L" }),
          costo({ id: "k2", unidad_medida: "Contenedor", concepto: "Flete" }),
        ],
        "emb-1", hijos,
      );
      // 1 BL + 2 hijos × 1 Contenedor = 3 filas
      expect(rows).toHaveLength(3);
      expect(rows[0].contenedor_id).toBeNull();
      expect(rows[1].contenedor_id).toBe("h1");
      expect(rows[2].contenedor_id).toBe("h2");
    });

    it("unidad_medida undefined por defecto se trata como Contenedor", () => {
      const rows = construirCostosRows(
        [costo({ unidad_medida: undefined })],
        "emb-1", hijos,
      );
      expect(rows).toHaveLength(2);
    });
  });

  describe("parsearVentasJsonb", () => {
    it("descarta entradas sin descripción y filas no-objeto", () => {
      const out = parsearVentasJsonb(
        [
          { descripcion: "", cantidad: 1 },
          null,
          ["not-an-obj"],
          "string",
          { descripcion: "Honorarios", cantidad: 1, precio_unitario: 500, moneda: "MXN", aplica_iva: true, total: 580 },
        ],
        "emb-1",
      );
      expect(out).toHaveLength(1);
      expect(out[0].descripcion).toBe("Honorarios");
      expect(out[0].embarque_id).toBe("emb-1");
    });

    it("respeta tasa_iva_aplicada explícita (incluso 0 para exento)", () => {
      const out = parsearVentasJsonb(
        [
          { descripcion: "Servicio exento", aplica_iva: true, tasa_iva_aplicada: 0, total: 100 },
          { descripcion: "Servicio gravado", aplica_iva: true, total: 116 },
          { descripcion: "Servicio sin IVA", aplica_iva: false, total: 100 },
        ],
        "emb-1",
      );
      expect(out[0].tasa_iva_aplicada).toBe(0);
      expect(out[1].tasa_iva_aplicada).toBe(0.16); // derivado
      expect(out[2].tasa_iva_aplicada).toBe(0);
    });

    it("normaliza moneda a MXN cuando no es exactamente 'USD'", () => {
      const out = parsearVentasJsonb(
        [
          { descripcion: "A", moneda: "USD", total: 1 },
          { descripcion: "B", moneda: "EUR", total: 1 }, // → MXN
          { descripcion: "C", moneda: undefined, total: 1 }, // → MXN
        ],
        "emb-1",
      );
      expect(out.map((r) => r.moneda)).toEqual(["USD", "MXN", "MXN"]);
    });
  });

  describe("flujo completo (composición real)", () => {
    it("transforma cotización con 2 contenedores + 1 BL + 1 Contenedor + 2 ventas", () => {
      const c = cot({ num_contenedores: 2, piezas: 20, peso_kg: 400, volumen_m3: 8 });
      const hijosPayload = construirHijosPayload("emb-X", c, 2, {
        pesoTotal: 400, volumenTotal: 8, piezasTotal: 20,
      });
      // Simular ids generados por la BD
      const hijos = hijosPayload.map((h, i) => ({ ...h, id: `h${i + 1}` })) as unknown as Tables<"embarque_contenedores">[];

      const costosRows = construirCostosRows(
        [
          costo({ id: "k1", unidad_medida: "BL", concepto: "B/L Fee", costo_unitario: 25 }),
          costo({ id: "k2", unidad_medida: "Contenedor", concepto: "THC", costo_unitario: 80 }),
        ],
        "emb-X", hijos,
      );
      const ventasRows = parsearVentasJsonb(
        [
          { descripcion: "Flete venta", cantidad: 1, precio_unitario: 1200, moneda: "USD", aplica_iva: false, total: 1200 },
          { descripcion: "Honorarios", cantidad: 1, precio_unitario: 500, moneda: "MXN", aplica_iva: true, total: 580 },
        ],
        "emb-X",
      );

      // Aserciones de contrato
      expect(hijos).toHaveLength(2);
      expect(costosRows).toHaveLength(3); // 1 BL + 2 hijos × 1 Contenedor
      expect(costosRows.filter((r) => r.contenedor_id === null)).toHaveLength(1);
      expect(costosRows.filter((r) => r.contenedor_id !== null).map((r) => r.contenedor_id)).toEqual(["h1", "h2"]);
      expect(ventasRows).toHaveLength(2);
      expect(ventasRows.every((v) => v.embarque_id === "emb-X")).toBe(true);
    });
  });
});
