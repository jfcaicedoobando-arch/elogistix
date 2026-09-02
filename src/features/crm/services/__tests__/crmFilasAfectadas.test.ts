/**
 * v13.823.49 — PostgREST devuelve 0 filas SIN error cuando RLS filtra el
 * registro o ya fue eliminado. Estas pruebas fijan que leads y actividades
 * fallen en ese caso en lugar de reportar éxito.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { updateLead, softDeleteLead } from "@/features/crm/services/leads/mutations";
import {
  completarActividad,
  posponerActividad,
  actualizarActividadNotas,
} from "@/features/crm/services/actividades";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

describe("leads — filas afectadas", () => {
  it("falla cuando el UPDATE no afecta filas", async () => {
    mock.setTableResult("crm_leads", { data: null, error: null });
    await expect(updateLead("l-1", { empresa: "ACME" })).rejects.toThrow(/no tienes permiso|ya no existe/i);
  });

  it("resuelve cuando devuelve la fila", async () => {
    mock.setTableResult("crm_leads", { data: { id: "l-1" }, error: null });
    await expect(updateLead("l-1", { empresa: "ACME" })).resolves.toBeUndefined();
  });

  it("el soft-delete también exige fila afectada", async () => {
    mock.setTableResult("crm_leads", { data: null, error: null });
    await expect(softDeleteLead("l-1", "u-1")).rejects.toThrow();
  });
});

describe("actividades — filas afectadas", () => {
  it("completar falla con 0 filas", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await expect(completarActividad({ id: "a-1" })).rejects.toThrow(/actividad/i);
  });

  it("posponer falla con 0 filas", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await expect(posponerActividad({ id: "a-1", dias: 2, fechaProgramada: null })).rejects.toThrow();
  });

  it("notas falla con 0 filas y resuelve con fila", async () => {
    mock.setTableResult("crm_actividades", { data: null, error: null });
    await expect(actualizarActividadNotas({ id: "a-1", resultado: "ok" })).rejects.toThrow();
    mock.setTableResult("crm_actividades", { data: { id: "a-1" }, error: null });
    await expect(actualizarActividadNotas({ id: "a-1", resultado: "ok" })).resolves.toBeUndefined();
  });
});
