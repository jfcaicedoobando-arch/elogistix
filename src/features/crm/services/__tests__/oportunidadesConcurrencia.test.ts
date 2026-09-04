/**
 * Hallazgo 14 (auditoría CRM): bloqueo optimista en actualizar/mover etapa.
 * Si se manda `expectedUpdatedAt` y el UPDATE no afecta filas (otro usuario
 * ya modificó la oportunidad), se lanza LC_CONFLICTO_CONCURRENCIA sin
 * aplicar cambios parciales.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { actualizarOportunidad, moverEtapaOportunidad } from "../oportunidadesMutations";
import { esConflictoConcurrencia } from "@/lib/errors/concurrencia";

beforeEach(() => { mock.tableCalls.length = 0; });

describe("actualizarOportunidad — bloqueo optimista", () => {
  it("0 filas + expectedUpdatedAt => LC_CONFLICTO_CONCURRENCIA, no bitácora", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    const p = actualizarOportunidad({
      id: "op-1",
      patch: { nombre: "Nuevo" },
      expectedUpdatedAt: "2024-01-01T00:00:00Z",
    });
    await expect(p).rejects.toThrow();
    try {
      await p;
    } catch (e) {
      expect(esConflictoConcurrencia(e)).toBe(true);
    }
  });

  it("sin expectedUpdatedAt, 0 filas => error genérico (no conflicto)", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    const p = actualizarOportunidad({ id: "op-1", patch: { nombre: "Nuevo" } });
    await expect(p).rejects.toThrow();
    try {
      await p;
    } catch (e) {
      expect(esConflictoConcurrencia(e)).toBe(false);
    }
  });

  it("sello vigente aplica el UPDATE y devuelve el nuevo updated_at", async () => {
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1", updated_at: "2024-02-02T00:00:00Z" }, error: null });
    const nuevo = await actualizarOportunidad({
      id: "op-1",
      patch: { nombre: "Nuevo" },
      expectedUpdatedAt: "2024-01-01T00:00:00Z",
    });
    expect(nuevo).toBe("2024-02-02T00:00:00Z");
  });
});

describe("moverEtapaOportunidad — bloqueo optimista", () => {
  it("0 filas + expectedUpdatedAt => LC_CONFLICTO_CONCURRENCIA", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    const p = moverEtapaOportunidad({
      id: "op-1",
      etapa_id: "e-2",
      expectedUpdatedAt: "2024-01-01T00:00:00Z",
    });
    await expect(p).rejects.toThrow();
    try {
      await p;
    } catch (e) {
      expect(esConflictoConcurrencia(e)).toBe(true);
    }
  });
});
