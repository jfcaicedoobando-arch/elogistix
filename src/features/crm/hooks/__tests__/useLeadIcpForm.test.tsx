/**
 * Regresión — el borrador del Perfil ICP no se pierde ante un refetch del mismo
 * lead (por ejemplo al guardar el correo en "Datos del lead").
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLeadIcpForm } from "@/features/crm/hooks/useLeadIcpForm";
import type { LeadIcpSource } from "@/features/crm/domain/leads/icp";

const LEAD_A: LeadIcpSource & { id: string } = { id: "lead-a", sector: "Automotriz", mercancia: null };
const LEAD_B: LeadIcpSource & { id: string } = { id: "lead-b", sector: "Textil", mercancia: null };

describe("useLeadIcpForm", () => {
  it("conserva los cambios no guardados cuando el mismo lead se refresca", () => {
    const { result, rerender } = renderHook(
      ({ lead }) => useLeadIcpForm(lead, lead.id),
      { initialProps: { lead: LEAD_A } },
    );

    act(() => result.current.set("mercancia", "Autopartes"));
    expect(result.current.form.mercancia).toBe("Autopartes");
    expect(result.current.dirty).toBe(true);

    // Nueva referencia del MISMO lead (refetch tras guardar otro campo).
    rerender({ lead: { ...LEAD_A, email: "kam@librecarga.com" } as typeof LEAD_A });

    expect(result.current.form.mercancia).toBe("Autopartes");
    expect(result.current.dirty).toBe(true);
  });

  it("reinicia el formulario al cambiar de lead", () => {
    const { result, rerender } = renderHook(
      ({ lead }) => useLeadIcpForm(lead, lead.id),
      { initialProps: { lead: LEAD_A } },
    );

    act(() => result.current.set("mercancia", "Autopartes"));
    rerender({ lead: LEAD_B });

    expect(result.current.form.mercancia).toBe("");
    expect(result.current.form.sector).toBe("Textil");
    expect(result.current.dirty).toBe(false);
  });

  it("deja dirty=false cuando la fila guardada ya refleja lo capturado", () => {
    const { result, rerender } = renderHook(
      ({ lead }) => useLeadIcpForm(lead, lead.id),
      { initialProps: { lead: LEAD_A } },
    );

    act(() => result.current.set("mercancia", "Autopartes"));
    rerender({ lead: { ...LEAD_A, mercancia: "Autopartes" } });

    expect(result.current.form.mercancia).toBe("Autopartes");
    expect(result.current.dirty).toBe(false);
  });
});
