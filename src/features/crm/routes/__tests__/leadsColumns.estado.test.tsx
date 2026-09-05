/**
 * Regresión: cambiar el estado de un lead desde la tabla debe producir un
 * único feedback cuando la mutación falla (el aviso vive en useActualizarLead).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { makeLeadsColumns } from "../leadsColumns";
import type { CrmLeadRow } from "@/features/crm/hooks";

const notifyError = vi.fn();
const mutateAsync = vi.fn();

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: vi.fn(),
}));

vi.mock("@/features/crm/hooks", async (orig) => {
  const real = await orig<Record<string, unknown>>();
  return { ...real, useActualizarLead: () => ({ mutateAsync, isPending: false }) };
});

const lead = {
  id: "l1",
  empresa: "ACME",
  estado: "Nuevo",
  vendedor_id: "u1",
} as unknown as CrmLeadRow;

const renderEstado = () => {
  const cols = makeLeadsColumns(new Set(), () => {}, () => {}, [lead], {
    puedeGestionarLead: () => true,
    puedeSeleccionar: false,
  });
  const col = cols.find((c) => c.id === "estado");
  const cell = col?.cell as (ctx: unknown) => React.ReactElement;
  return render(cell({ row: { original: lead } }) as React.ReactElement);
};

describe("leadsColumns · EstadoCell", () => {
  beforeEach(() => {
    notifyError.mockClear();
    mutateAsync.mockReset();
  });

  it("no duplica el aviso de error cuando la mutación falla", async () => {
    mutateAsync.mockRejectedValue(new Error("RLS"));
    renderEstado();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    const opcion = await screen.findByRole("option", { name: "Contactado" });
    fireEvent.click(opcion);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("propaga el cambio exitoso sin avisos locales", async () => {
    mutateAsync.mockResolvedValue(undefined);
    renderEstado();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Contactado" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(notifyError).not.toHaveBeenCalled();
  });
});
