/**
 * Validación mínima del alta rápida de lead: el campo "Empresa" es obligatorio
 * y el botón "Crear" debe bloquearse (con mensaje accesible) mientras esté vacío.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QuickCreateLeadDialog from "@/features/crm/components/quickCreate/QuickCreateLeadDialog";

const mutateAsync = vi.fn(async (_input: Record<string, unknown>) => ({ id: "lead-1" }));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "kam@librecarga.com" } }),
}));
vi.mock("@/features/crm/hooks", () => ({
  useCrearLead: () => ({ mutateAsync, isPending: false }),
}));

describe("QuickCreateLeadDialog", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
  });

  it("deshabilita 'Crear' y muestra error inline mientras Empresa está vacía", async () => {
    render(<QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />);

    const empresaInput = screen.getByLabelText(/Empresa/i);
    const crearBtn = screen.getByRole("button", { name: /Crear/i });

    expect(empresaInput).toHaveValue("");
    expect(crearBtn).toBeDisabled();

    fireEvent.blur(empresaInput);
    await waitFor(() => {
      expect(screen.getByText("Indica la empresa para continuar.")).toBeInTheDocument();
    });
    expect(empresaInput).toHaveAttribute("aria-invalid", "true");

    fireEvent.click(crearBtn);
    await waitFor(() => expect(mutateAsync).not.toHaveBeenCalled());
  });

  it("permite crear cuando Empresa tiene valor", async () => {
    render(<QuickCreateLeadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />);

    const empresaInput = screen.getByLabelText(/Empresa/i);
    const crearBtn = screen.getByRole("button", { name: /Crear/i });

    fireEvent.change(empresaInput, { target: { value: "  Acme Logistics  " } });
    expect(crearBtn).toBeEnabled();

    fireEvent.click(crearBtn);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0]![0];
    expect(payload.empresa).toBe("Acme Logistics");
  });
});
