import { describe, it, expect } from "vitest";
import {
  clienteInsertSchema,
  cotizacionInputSchema,
  embarqueInsertSchema,
  notaSchema,
  parseOrThrow,
} from "../mutationSchemas";

describe("mutationSchemas", () => {
  describe("clienteInsertSchema", () => {
    it("acepta cliente mínimo válido", () => {
      const r = clienteInsertSchema.safeParse({ nombre: "Acme" });
      expect(r.success).toBe(true);
    });
    it("rechaza nombre vacío", () => {
      const r = clienteInsertSchema.safeParse({ nombre: "  " });
      expect(r.success).toBe(false);
    });
    it("rechaza email inválido", () => {
      const r = clienteInsertSchema.safeParse({ nombre: "X", email: "no-es-email" });
      expect(r.success).toBe(false);
    });
    it("acepta dias_credito en rango", () => {
      const r = clienteInsertSchema.safeParse({ nombre: "X", dias_credito: 30 });
      expect(r.success).toBe(true);
    });
    it("rechaza dias_credito negativo", () => {
      const r = clienteInsertSchema.safeParse({ nombre: "X", dias_credito: -1 });
      expect(r.success).toBe(false);
    });
  });

  describe("cotizacionInputSchema", () => {
    const base = {
      cliente_nombre: "Acme",
      es_prospecto: false,
      modo: "Maritimo",
      tipo: "Importacion",
      incoterm: "FOB",
      descripcion_mercancia: "Cajas",
      origen: "Shanghai",
      destino: "Manzanillo",
      moneda: "USD",
      vigencia_dias: 15,
      subtotal: 100,
      conceptos_venta: [{ descripcion: "Flete", cantidad: 1, precio_unitario: 100, total: 100 }],
    };
    it("acepta input completo", () => {
      expect(cotizacionInputSchema.safeParse(base).success).toBe(true);
    });
    it("rechaza sin conceptos", () => {
      expect(cotizacionInputSchema.safeParse({ ...base, conceptos_venta: [] }).success).toBe(false);
    });
    it("rechaza vigencia 0", () => {
      expect(cotizacionInputSchema.safeParse({ ...base, vigencia_dias: 0 }).success).toBe(false);
    });
    it("rechaza subtotal negativo", () => {
      expect(cotizacionInputSchema.safeParse({ ...base, subtotal: -1 }).success).toBe(false);
    });
  });

  describe("embarqueInsertSchema", () => {
    it("acepta embarque con campos mínimos", () => {
      const r = embarqueInsertSchema.safeParse({
        cliente_nombre: "Acme",
        modo: "Maritimo",
        operador: "Juan",
      });
      expect(r.success).toBe(true);
    });
    it("rechaza sin operador", () => {
      const r = embarqueInsertSchema.safeParse({ cliente_nombre: "Acme", modo: "Maritimo" });
      expect(r.success).toBe(false);
    });
  });

  describe("notaSchema", () => {
    it("acepta nota válida", () => {
      expect(notaSchema.safeParse({ contenido: "Ok", usuario: "a@b.com" }).success).toBe(true);
    });
    it("rechaza nota vacía", () => {
      expect(notaSchema.safeParse({ contenido: "   ", usuario: "a@b.com" }).success).toBe(false);
    });
  });

  describe("parseOrThrow", () => {
    it("retorna data en éxito", () => {
      const r = parseOrThrow(notaSchema, { contenido: "Hola", usuario: "x" }, "Nota");
      expect(r.contenido).toBe("Hola");
    });
    it("lanza Error con contexto y path en falla", () => {
      expect(() =>
        parseOrThrow(notaSchema, { contenido: "", usuario: "" }, "Nota"),
      ).toThrow(/Nota —/);
    });
  });
});
