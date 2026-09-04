/**
 * Regresión (smoke KAM): el correo capturado en el alta rápida
 * ("Correo o teléfono") debe llegar a la columna canónica `email` y prefijar el
 * input "Correo" de la ficha, tanto al abrir como al recargar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { createLead } from "../mutations";
import { getLead } from "../queries";
import { useLeadEditForm } from "@/features/crm/hooks/useLeadEditForm";
import { leadQuickCreateInput } from "@/features/crm/domain/leads/quickCreateInput";
import type { CrmLeadRow } from "@/features/crm/domain/leads/constants";

const CORREO = "qa-smoke-kam@example.test";
const user = { id: "usr-kam", email: "kam@librecarga.com" };

function filaPersistida(payload: Record<string, unknown>): CrmLeadRow {
  return {
    id: "lead-1",
    empresa: payload.empresa,
    contacto: payload.contacto ?? "",
    email: payload.email ?? "",
    telefono: payload.telefono ?? "",
    ciudad: "",
    pais: "",
    fuente: "Otro",
    estado: "Nuevo",
    score: 3,
    interes_modo: null,
    vendedor_id: user.id,
    vendedor_email: user.email,
    notas: null,
    oportunidad_convertida_id: null,
    cliente_convertido_id: null,
    created_at: "2026-09-04T00:00:00Z",
    updated_at: "2026-09-04T00:00:00Z",
  } as unknown as CrmLeadRow;
}

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

describe("correo canónico del lead (alta rápida → ficha → recarga)", () => {
  it("guarda el correo en `email` y lo prefija en el formulario de la ficha", async () => {
    mock.setTableResult("crm_leads", { data: { id: "lead-1" }, error: null });
    const input = leadQuickCreateInput("QA Smoke KAM", ` ${CORREO} `, user);
    await createLead(input, user);

    const payload = mock.getMutationPayload("crm_leads", "insert") as Record<string, unknown>;
    expect(payload.email).toBe(CORREO);
    expect(payload.telefono).toBe("");

    // Abrir la ficha: el input "Correo" se deriva de la fila persistida.
    mock.tableCalls.length = 0;
    mock.setTableResult("crm_leads", { data: filaPersistida(payload), error: null });
    const lead = await getLead("lead-1");
    const { result, rerender } = renderHook(({ l }) => useLeadEditForm(l), {
      initialProps: { l: lead },
    });
    expect(result.current.form.email).toBe(CORREO);

    // Recarga (refetch del mismo lead): el correo sigue prefijado.
    const recargado = await getLead("lead-1");
    rerender({ l: recargado });
    expect(result.current.form.email).toBe(CORREO);

    // Editar sólo Notas no borra el correo.
    act(() => result.current.set("notas", "Llamar mañana"));
    expect(result.current.form.email).toBe(CORREO);
    expect(result.current.patch).toEqual({ notas: "Llamar mañana" });
  });

  it("clasifica como teléfono cuando el valor no es un correo", () => {
    const input = leadQuickCreateInput("QA Tel", " 5551234567 ", user);
    expect(input.email).toBe("");
    expect(input.telefono).toBe("5551234567");
  });
});
