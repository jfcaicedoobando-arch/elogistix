/**
 * Tests para `crearCotizacion` — boundary zod, folio, error propagation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../../queries", () => ({
  generarFolioCotizacion: vi.fn().mockResolvedValue("COT-2026-0001"),
}));

import { crearCotizacion } from "../crear";
import { generarFolioCotizacion } from "../../queries";
import type { CreateCotizacionInput } from "@/features/cotizacion/types";

const baseInput: CreateCotizacionInput = {
  cliente_nombre: "Acme SA",
  es_prospecto: false,
  cliente_id: "11111111-1111-4111-8111-111111111111",
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  descripcion_mercancia: "Electrónicos",
  peso_kg: 100,
  volumen_m3: 1,
  piezas: 10,
  origen: "Shanghai",
  destino: "Manzanillo",
  conceptos_venta: [
    {
      descripcion: "Flete",
      cantidad: 1,
      precio_unitario: 1500,
      total: 1500,
      unidad_medida: "BL",
      moneda: "USD",
      aplica_iva: false,
    },
  ],
  subtotal: 1500,
  moneda: "USD",
  vigencia_dias: 30,
  notas: "",
  operador: "Op1",
};

beforeEach(() => {
  mock.tableCalls.length = 0;
  vi.mocked(generarFolioCotizacion).mockClear().mockResolvedValue("COT-2026-0001");
});

describe("crearCotizacion", () => {
  it("happy path: genera folio, inserta y devuelve la cotización", async () => {
    mock.setTableResult("cotizaciones", {
      data: { id: "cot-1", folio: "COT-2026-0001", estado: "Borrador" },
      error: null,
    });
    const r = await crearCotizacion(baseInput);
    expect(r.id).toBe("cot-1");
    expect(r.folio).toBe("COT-2026-0001");
    expect(generarFolioCotizacion).toHaveBeenCalledOnce();
  });

  it("propaga error de Supabase en el insert", async () => {
    mock.setTableResult("cotizaciones", {
      data: null,
      error: { message: "RLS denied" },
    });
    await expect(crearCotizacion(baseInput)).rejects.toThrow();
  });

  it("zod boundary: cliente_nombre vacío lanza error con contexto 'Cotización'", async () => {
    await expect(crearCotizacion({ ...baseInput, cliente_nombre: "" })).rejects.toThrow(
      /Cotización/,
    );
  });

  it("zod boundary: vigencia_dias = 0 lanza error de mínimo", async () => {
    await expect(crearCotizacion({ ...baseInput, vigencia_dias: 0 })).rejects.toThrow(
      /mínimo 1/,
    );
  });

  it("zod boundary: vigencia_dias = 366 lanza error de máximo", async () => {
    await expect(crearCotizacion({ ...baseInput, vigencia_dias: 366 })).rejects.toThrow(
      /máximo 365/,
    );
  });

  it("zod boundary: subtotal negativo lanza error", async () => {
    await expect(crearCotizacion({ ...baseInput, subtotal: -1 })).rejects.toThrow(/Subtotal/);
  });

  it("zod boundary: modo vacío lanza error", async () => {
    await expect(crearCotizacion({ ...baseInput, modo: "" })).rejects.toThrow(/Modo/);
  });

  it("no llama insert si la validación falla", async () => {
    await expect(crearCotizacion({ ...baseInput, cliente_nombre: "" })).rejects.toThrow();
    expect(mock.tableCalls).toHaveLength(0);
    expect(generarFolioCotizacion).not.toHaveBeenCalled();
  });
});
