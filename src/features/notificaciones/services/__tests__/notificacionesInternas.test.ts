/**
 * Ronda YAGNI · defecto 8 — el cliente sólo puede tocar `leida` / `leida_at`
 * de una notificación interna (el grant de columnas lo impone en la base).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { marcarLeida, marcarTodasLeidas } from "../notificacionesInternas";

const CAMPOS_PERMITIDOS = ["leida", "leida_at"];

describe("notificacionesInternas", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.setTableResult("notificaciones_internas", { data: [], error: null });
  });

  it("marcarLeida sólo actualiza leida y leida_at", async () => {
    await marcarLeida("n1");
    const call = mock.tableCalls.find((c) => c.table === "notificaciones_internas");
    expect(call?.ops).toContain("update");
    const payload = (call?.payload ?? {}) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(CAMPOS_PERMITIDOS);
  });

  it("marcarTodasLeidas sólo actualiza leida y leida_at", async () => {
    await marcarTodasLeidas("u1");
    const call = mock.tableCalls.find((c) => c.table === "notificaciones_internas");
    const payload = (call?.payload ?? {}) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(CAMPOS_PERMITIDOS);
  });
});
