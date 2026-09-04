/**
 * v13.823.78 — La edición de la ficha de lead valida el correo igual que el
 * alta: correo inválido no llega a la mutación; vacío (con teléfono) y válido sí.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const actualizarMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/crm/hooks", () => ({
  useActualizarLead: () => ({ mutateAsync: actualizarMutateAsync, isPending: false }),
  useEliminarLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTomarLead: () => ({ mutate: vi.fn(), isPending: false }),
  useCalificarProspecto: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { useLeadDetalleAcciones } from "../useLeadDetalleAcciones";
import type { LeadEditForm } from "@/types/crm/leadEditForm";

const LEAD = { id: "9c0a0a26-4b1c-4a8e-bb2b-0a1de9a4d111", empresa: "QA Demo SA" };

function render(patch: Partial<LeadEditForm>) {
  return renderHook(() => useLeadDetalleAcciones(LEAD.id, LEAD, patch));
}

beforeEach(() => {
  actualizarMutateAsync.mockClear();
});

describe("useLeadDetalleAcciones · validación de correo al editar", () => {
  it("correo inválido no llama a la mutación y expone error inline", async () => {
    const { result } = render({ email: "foo" });
    await act(async () => { await result.current.handleSave(); });
    expect(actualizarMutateAsync).not.toHaveBeenCalled();
    expect(result.current.errorEmail).toBeTruthy();
  });

  it("correo vacío con teléfono sí guarda", async () => {
    const { result } = render({ email: "", telefono: "5544332211" });
    await act(async () => { await result.current.handleSave(); });
    expect(actualizarMutateAsync).toHaveBeenCalledWith({
      id: LEAD.id,
      patch: { email: "", telefono: "5544332211" },
    });
    expect(result.current.errorEmail).toBeNull();
  });

  it("correo válido sí guarda", async () => {
    const { result } = render({ email: "kam@chinocochino.com" });
    await act(async () => { await result.current.handleSave(); });
    expect(actualizarMutateAsync).toHaveBeenCalledTimes(1);
    expect(result.current.errorEmail).toBeNull();
  });
});
