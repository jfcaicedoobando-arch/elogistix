/**
 * Tests para `crearCotizacion` — boundary zod, folio atómico vía RPC, error propagation.
 * v13.303.0: folio se genera vía `supabase.rpc("siguiente_folio_cotizacion")`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { runWithFrozenClock } from "@/test/helpers/withFrozenClock";
import { crearCotizacion } from "../crear";
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
  mock.resetResults();
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.setRpcResult("siguiente_folio_cotizacion", { data: "COT-2026-0001", error: null });
});

describe("crearCotizacion", () => {
  it("happy path: pide folio a la RPC, inserta y devuelve la cotización", async () => {
    mock.setTableResult("cotizaciones", {
      data: { id: "cot-1", folio: "COT-2026-0001", estado: "Borrador" },
      error: null,
    });
    const r = await crearCotizacion(baseInput);
    expect(r.id).toBe("cot-1");
    expect(r.folio).toBe("COT-2026-0001");
    // La bitácora también es una RPC (DEFECTO 8): se excluye del conteo.
    const negocio = mock.rpcCalls.filter((c) => c.fn !== "registrar_bitacora");
    expect(negocio).toHaveLength(1);
    expect(negocio[0].fn).toBe("siguiente_folio_cotizacion");
  });

  it("falla si la RPC devuelve error", async () => {
    mock.setRpcResult("siguiente_folio_cotizacion", {
      data: null,
      error: { message: "LC_ORG_NO_RESUELTA" },
    });
    await expect(crearCotizacion(baseInput)).rejects.toThrow();
  });

  it("falla si la RPC devuelve payload vacío o no-string", async () => {
    mock.setRpcResult("siguiente_folio_cotizacion", { data: null, error: null });
    await expect(crearCotizacion(baseInput)).rejects.toThrow(/folio/i);
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

  it("no pide folio ni insert si la validación falla", async () => {
    await expect(crearCotizacion({ ...baseInput, cliente_nombre: "" })).rejects.toThrow();
    expect(mock.tableCalls).toHaveLength(0);
    expect(mock.rpcCalls).toHaveLength(0);
  });

  it("A11: la vigencia se calcula con la fecha CDMX (19:00 MX no se corre un día)", async () => {
    // 2026-08-11T01:00:00Z = 10/08/2026 19:00 en CDMX.
    await runWithFrozenClock("2026-08-11T01:00:00Z", async () => {
      mock.setTableResult("cotizaciones", { data: { id: "cot-9" }, error: null });
      await crearCotizacion({ ...baseInput, vigencia_dias: 30 });
      const payload = mock.getMutationPayload("cotizaciones") as { fecha_vigencia?: string };
      expect(payload?.fecha_vigencia).toBe("2026-09-09");
    });
  });
});
