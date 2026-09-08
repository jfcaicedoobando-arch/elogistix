/**
 * REM-VIS-04: `QuickAddFullDialogs` mantiene `NuevoLeadDialog` MONTADO con
 * `open=false`, así que el "intento" de validación sobrevivía al cierre: enviar
 * con Empresa vacía → Cancelar → reabrir "Más campos" mostraba el error inline
 * de inmediato. La regresión reutiliza el MISMO componente montado alternando
 * `open` (un unmount ocultaría el bug).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NuevoLeadDialog from "@/features/crm/components/NuevoLeadDialog";

const mutateAsync = vi.fn(async () => ({ id: "lead-1" }));

vi.mock("@/features/crm/hooks", () => ({
  useCrearLead: () => ({ mutateAsync, isPending: false }),
  useCrearActividad: () => ({ mutateAsync: vi.fn(), isPending: false }),
  LEAD_ESTADOS_MANUALES: ["Nuevo"] as const,
  LEAD_FUENTES: ["Prospección"] as const,
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "kam@acme.com" } }),
}));
vi.mock("@/features/crm/components/VendedorSelect", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/AvisoLeadDuplicado", () => ({ AvisoLeadDuplicado: () => <div /> }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

describe("NuevoLeadDialog — validación por sesión del diálogo", () => {
  beforeEach(() => mutateAsync.mockClear());

  it("al reabrir el mismo diálogo montado no arrastra el error del intento anterior", () => {
    const { rerender } = render(<NuevoLeadDialog open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Crear lead/i }));
    expect(screen.getByRole("alert").textContent).toMatch(/Indica la empresa/i);

    // Cierre externo (Cancelar / Esc), sin desmontar el componente.
    rerender(<NuevoLeadDialog open={false} onOpenChange={vi.fn()} />);
    rerender(<NuevoLeadDialog open onOpenChange={vi.fn()} />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText(/Empresa/i)).not.toHaveAttribute("aria-invalid", "true");
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("conserva el error dentro de la misma sesión tras un intento inválido", () => {
    render(<NuevoLeadDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Crear lead/i }));
    // Un re-render sin cambiar `open` no borra la validación en curso.
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
