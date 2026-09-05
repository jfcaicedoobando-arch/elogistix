import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NuevoLeadDialog from "@/features/crm/components/NuevoLeadDialog";

const mutateAsync = vi.fn(async () => ({ id: "lead-1" }));
const mutateActividad = vi.fn(async () => ({ id: "act-1" }));

vi.mock("@/features/crm/hooks", () => ({
  useCrearLead: () => ({ mutateAsync, isPending: false }),
  useCrearActividad: () => ({ mutateAsync: mutateActividad, isPending: false }),
  LEAD_ESTADOS_MANUALES: ["Nuevo"] as const,
  LEAD_FUENTES: ["Otro"] as const,
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "kam@acme.com" } }),
}));
vi.mock("@/features/crm/components/VendedorSelect", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/AvisoLeadDuplicado", () => ({ AvisoLeadDuplicado: () => <div /> }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

const llenar = (label: RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: valor } });

describe("NuevoLeadDialog — cancelar limpia el formulario", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    mutateActividad.mockClear();
  });

  it("al cancelar y reabrir el formulario vuelve a estar vacío", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<NuevoLeadDialog open onOpenChange={onOpenChange} />);

    llenar(/Empresa/i, "Acme");
    llenar(/^Correo$/i, "qa@acme.com");
    expect((screen.getByLabelText(/Empresa/i) as HTMLInputElement).value).toBe("Acme");

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    // Como hay datos capturados, el diálogo pide confirmación antes de descartar
    // (mismo comportamiento que Escape o clic fuera).
    fireEvent.click(screen.getByRole("button", { name: /Descartar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Simula que el padre cierra y vuelve a abrir el diálogo.
    rerender(<NuevoLeadDialog open={false} onOpenChange={onOpenChange} />);
    rerender(<NuevoLeadDialog open onOpenChange={onOpenChange} />);

    expect((screen.getByLabelText(/Empresa/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Correo$/i) as HTMLInputElement).value).toBe("");
  });
});
