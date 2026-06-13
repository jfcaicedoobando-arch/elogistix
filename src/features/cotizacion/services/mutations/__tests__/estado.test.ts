/**
 * Tests para `updateEstadoCotizacion`.
 * NOTA: el service NO valida transiciones de estado — esa responsabilidad
 * es de la capa que invoca. Este test documenta el comportamiento actual.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { updateEstadoCotizacion } from "../estado";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("updateEstadoCotizacion", () => {
  it.each([
    ["Aceptada"],
    ["Rechazada"],
    ["Borrador"],
    ["Enviada"],
    ["Vencida"],
    ["En operación"],
  ])("happy path: estado %s", async (estado) => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await expect(updateEstadoCotizacion("cot-1", estado)).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.table).toBe("cotizaciones");
    expect(mock.tableCalls[0]?.ops).toEqual(["update", "eq"]);
  });

  it("propaga error de Supabase al cambiar estado", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "row not found" } });
    await expect(updateEstadoCotizacion("cot-x", "Aceptada")).rejects.toBeTruthy();
  });

  it("acepta estado arbitrario sin guard (responsabilidad del caller)", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await expect(updateEstadoCotizacion("cot-1", "EstadoInexistente")).resolves.toBeUndefined();
  });
});
