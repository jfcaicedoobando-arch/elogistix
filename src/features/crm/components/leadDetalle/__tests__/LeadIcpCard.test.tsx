/**
 * v13.823.108 — perfil ICP del lead:
 * si el guardado falla no se duplica el aviso de error
 * (useActualizarLead ya notifica en onError).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import LeadIcpCard from "@/features/crm/components/leadDetalle/LeadIcpCard";

const mutateAsync = vi.fn(async (_input: Record<string, unknown>) => ({}));
const notifyError = vi.fn();
const successToast = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useActualizarLead: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
}));

vi.mock("@/features/crm/lib/crmToast", () => ({
  crmToast: { success: (...args: unknown[]) => successToast(...args) },
}));

describe("LeadIcpCard", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    notifyError.mockClear();
    successToast.mockClear();
  });

  function setup() {
    render(
      <LeadIcpCard leadId="l1" lead={{}} canEdit />,
      { wrapper: createWrapper() },
    );
  }

  it("guarda el perfil ICP y muestra el toast de éxito", async () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText(/Automotriz, agroindustria/i), {
      target: { value: "Automotriz" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar perfil ICP/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(successToast).toHaveBeenCalledWith("Perfil ICP guardado");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("ICP: si falla no repite el aviso de error (el hook ya notifica)", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("RLS denegado"));
    setup();
    fireEvent.change(screen.getByPlaceholderText(/Automotriz, agroindustria/i), {
      target: { value: "Automotriz" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar perfil ICP/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(notifyError).not.toHaveBeenCalled());
    expect(successToast).not.toHaveBeenCalled();
  });
});
