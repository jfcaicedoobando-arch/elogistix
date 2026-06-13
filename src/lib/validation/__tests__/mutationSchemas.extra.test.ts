import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  parseOrThrow,
  clienteInsertSchema,
  clienteUpdateSchema,
  cotizacionDraftInputSchema,
  embarqueInsertSchema,
  notaSchema,
  eventoTrackingSchema,
} from "@/lib/validation/mutationSchemas";

describe("mutationSchemas | parseOrThrow", () => {
  it("01 — retorna el valor parseado cuando el schema es válido", () => {
    const result = parseOrThrow(clienteInsertSchema, { nombre: "ACME" }, "test");
    expect(result.nombre).toBe("ACME");
  });

  it("02 — lanza Error con el contexto en el mensaje cuando falla", () => {
    expect(() => parseOrThrow(clienteInsertSchema, { nombre: "" }, "Contexto")).toThrowError(/Contexto/);
  });

  it("03 — el Error lanzado tiene cause con el ZodError original", () => {
    let caught: unknown;
    try {
      parseOrThrow(clienteInsertSchema, {}, "ctx");
    } catch (e) {
      caught = e;
    }
    expect((caught as Error & { cause?: unknown }).cause).toBeDefined();
  });

  it("04 — el mensaje incluye el path del campo cuando existe", () => {
    let msg = "";
    try {
      parseOrThrow(clienteInsertSchema, { nombre: "" }, "ctx");
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toMatch(/nombre/i);
  });

  it("05 — funciona con schemas primitivos (z.string)", () => {
    const schema = z.string().min(3);
    expect(parseOrThrow(schema, "hello", "ctx")).toBe("hello");
  });
});

describe("mutationSchemas | clienteInsertSchema", () => {
  it("06 — acepta payload mínimo con solo nombre", () => {
    expect(clienteInsertSchema.safeParse({ nombre: "Empresa S.A." }).success).toBe(true);
  });
  it("07 — rechaza nombre vacío", () => {
    expect(clienteInsertSchema.safeParse({ nombre: "" }).success).toBe(false);
  });
  it("08 — rechaza nombre ausente", () => {
    expect(clienteInsertSchema.safeParse({}).success).toBe(false);
  });
  it("09 — rechaza nombre que supera 200 caracteres", () => {
    expect(clienteInsertSchema.safeParse({ nombre: "A".repeat(201) }).success).toBe(false);
  });
  it("10 — acepta email válido", () => {
    expect(clienteInsertSchema.safeParse({ nombre: "X", email: "a@b.com" }).success).toBe(true);
  });
  it("11 — rechaza email inválido", () => {
    expect(clienteInsertSchema.safeParse({ nombre: "X", email: "no-es-email" }).success).toBe(false);
  });
  it("13 — rechaza dias_credito negativo", () => {
    expect(clienteInsertSchema.safeParse({ nombre: "X", dias_credito: -1 }).success).toBe(false);
  });
  it("14 — rechaza dias_credito > 365", () => {
    expect(clienteInsertSchema.safeParse({ nombre: "X", dias_credito: 366 }).success).toBe(false);
  });
});

describe("mutationSchemas | clienteUpdateSchema", () => {
  it("16 — acepta objeto vacío (todos los campos son opcionales)", () => {
    expect(clienteUpdateSchema.safeParse({}).success).toBe(true);
  });
  it("17 — rechaza nombre explícitamente vacío", () => {
    expect(clienteUpdateSchema.safeParse({ nombre: "" }).success).toBe(false);
  });
});

describe("mutationSchemas | cotizacionDraftInputSchema", () => {
  const base = {
    cliente_nombre: "Cliente",
    es_prospecto: false,
    modo: "LCL",
    tipo: "Import",
    incoterm: "FOB",
    descripcion_mercancia: "Electrónica",
    origen: "Shanghai",
    destino: "Manzanillo",
    moneda: "USD",
    vigencia_dias: 30,
    subtotal: 1500,
    conceptos_venta: [],
  };
  it("18 — acepta payload completo válido", () => {
    expect(cotizacionDraftInputSchema.safeParse(base).success).toBe(true);
  });
  it("19 — rechaza vigencia_dias < 1", () => {
    expect(cotizacionDraftInputSchema.safeParse({ ...base, vigencia_dias: 0 }).success).toBe(false);
  });
  it("20 — rechaza vigencia_dias > 365", () => {
    expect(cotizacionDraftInputSchema.safeParse({ ...base, vigencia_dias: 366 }).success).toBe(false);
  });
  it("21 — rechaza subtotal negativo", () => {
    expect(cotizacionDraftInputSchema.safeParse({ ...base, subtotal: -1 }).success).toBe(false);
  });
});

describe("mutationSchemas | embarqueInsertSchema", () => {
  it("23 — acepta payload mínimo válido", () => {
    const r = embarqueInsertSchema.safeParse({ cliente_nombre: "X", modo: "FCL", operador: "Maersk" });
    expect(r.success).toBe(true);
  });
  it("24 — rechaza operador vacío", () => {
    expect(embarqueInsertSchema.safeParse({ cliente_nombre: "X", modo: "FCL", operador: "" }).success).toBe(false);
  });
});

describe("mutationSchemas | notaSchema", () => {
  it("25 — acepta nota válida", () => {
    expect(notaSchema.safeParse({ contenido: "Hola mundo", usuario: "user@x.com" }).success).toBe(true);
  });
  it("26 — rechaza contenido vacío", () => {
    expect(notaSchema.safeParse({ contenido: "", usuario: "u" }).success).toBe(false);
  });
  it("27 — rechaza usuario vacío", () => {
    expect(notaSchema.safeParse({ contenido: "c", usuario: "" }).success).toBe(false);
  });
});

describe("mutationSchemas | eventoTrackingSchema", () => {
  it("28 — acepta evento mínimo válido", () => {
    expect(eventoTrackingSchema.safeParse({ tipo: "Arribo", fecha: "2024-01-01" }).success).toBe(true);
  });
  it("29 — rechaza tipo vacío", () => {
    expect(eventoTrackingSchema.safeParse({ tipo: "", fecha: "2024-01-01" }).success).toBe(false);
  });
  it("30 — rechaza descripcion > 500 caracteres", () => {
    expect(eventoTrackingSchema.safeParse({ tipo: "t", fecha: "2024-01-01", descripcion: "x".repeat(501) }).success).toBe(false);
  });
});
