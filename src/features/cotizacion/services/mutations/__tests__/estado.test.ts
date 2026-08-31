/**
 * Tests para `updateEstadoCotizacion`.
 *
 * 13.115.0 (Sprint 1.4): el service ahora valida que `estado` sea uno del
 * enum `estado_cotizacion`. Antes aceptaba cualquier string y fallaba en BD.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { updateEstadoCotizacion, ESTADOS_COTIZACION_VALIDOS } from "../estado";
import { assertUpdatePayload, assertEq, findTableCall } from "@/test/helpers/assertMutation";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("updateEstadoCotizacion", () => {
  it.each(ESTADOS_COTIZACION_VALIDOS)("happy path: acepta estado válido %s", async (estado) => {
    mock.setTableResult("cotizaciones", { data: { id: "cot-1" }, error: null });
    await expect(updateEstadoCotizacion("cot-1", estado)).resolves.toBeUndefined();
    const call = findTableCall(mock, "cotizaciones");
    assertUpdatePayload(call, { estado });
    assertEq(call, "id", "cot-1");
  });

  it("propaga error de Supabase al cambiar estado", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "row not found" } });
    await expect(updateEstadoCotizacion("cot-x", "Aceptada")).rejects.toThrow();
  });

  it("rechaza estado inválido SIN tocar la BD", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "cot-1" }, error: null });
    await expect(
      updateEstadoCotizacion("cot-1", "EstadoInexistente"),
    ).rejects.toThrow(/inválido/i);
    // Nada llegó a Supabase.
    expect(mock.tableCalls.length).toBe(0);
  });

  it("rechaza string vacío", async () => {
    await expect(updateEstadoCotizacion("cot-1", "")).rejects.toThrow(/inválido/i);
  });

  it("acepta embarqueId opcional y lo envía en el payload", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "cot-1" }, error: null });
    await updateEstadoCotizacion("cot-1", "En operación", "emb-123");
    assertUpdatePayload(findTableCall(mock, "cotizaciones"), {
      estado: "En operación",
      embarque_id: "emb-123",
    });
  });

  // v13.814.0 (hallazgo 1): 0 filas afectadas = RLS o cotización inexistente.
  it("lanza cuando el UPDATE afecta 0 filas", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await expect(updateEstadoCotizacion("cot-1", "Aceptada")).rejects.toThrow(
      /no tienes permiso o la cotización ya no existe/i,
    );
  });

  it("acepta embarqueId null para limpiar el vínculo", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "cot-1" }, error: null });
    await updateEstadoCotizacion("cot-1", "Borrador", null);
    assertUpdatePayload(findTableCall(mock, "cotizaciones"), {
      estado: "Borrador",
      embarque_id: null,
    });
  });
});
