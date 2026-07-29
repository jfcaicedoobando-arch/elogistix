/**
 * Tests para `updateCotizacion` — serialización JSONB, error propagation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { updateCotizacion } from "../update";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("updateCotizacion", () => {
  it("happy path: resuelve void cuando no hay error", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await expect(updateCotizacion("cot-1", { notas: "cambio" })).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.table).toBe("cotizaciones");
    expect(mock.tableCalls[0]?.ops).toContain("update");
    expect(mock.tableCalls[0]?.ops).toContain("eq");
  });

  it("propaga error de Supabase al actualizar cotización", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "RLS denied" } });
    await expect(updateCotizacion("cot-1", { notas: "x" })).rejects.toThrow();
  });

  it("acepta patch vacío sin lanzar", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await expect(updateCotizacion("cot-1", {})).resolves.toBeUndefined();
  });

  it("serializa conceptos_venta cuando viene en el patch", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await updateCotizacion("cot-1", {
      conceptos_venta: [
        {
          descripcion: "Flete",
          cantidad: 1,
          precio_unitario: 100,
          moneda: "USD",
          aplica_iva: false,
          total: 100,
          unidad_medida: "BL",
        },
      ],
    });
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });

  it("acepta cambios de enums (modo/tipo/incoterm/moneda) sin lanzar", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await expect(
      updateCotizacion("cot-1", {
        modo: "Aéreo",
        tipo: "Exportación",
        incoterm: "CIF",
        moneda: "MXN",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("updateCotizacion — validación zod (M4)", () => {
  it("rechaza conceptos con precio unitario negativo", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await expect(
      updateCotizacion("cot-1", {
        conceptos_venta: [
          {
            descripcion: "Flete",
            cantidad: 1,
            precio_unitario: -100,
            moneda: "USD",
            aplica_iva: false,
            total: 100,
            unidad_medida: "BL",
          },
        ],
      }),
    ).rejects.toThrow(/No se pudo actualizar la cotización/);
    expect(mock.tableCalls.length).toBe(0);
  });

  it("rechaza subtotal negativo sin tocar la base", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await expect(updateCotizacion("cot-1", { subtotal: -5 })).rejects.toThrow();
    expect(mock.tableCalls.length).toBe(0);
  });
});
