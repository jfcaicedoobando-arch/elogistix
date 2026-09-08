/**
 * VIS-20260908-04: al enviar "Nuevo lead" sin Empresa sólo aparecía un toast
 * temporal con "Ver detalles" (diálogo técnico) mientras el campo quedaba fuera
 * de vista. Ahora el error vive junto al campo y no se reporta como error
 * inesperado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NuevoLeadDialog from "@/features/crm/components/NuevoLeadDialog";

const mutateAsync = vi.fn(async () => ({ id: "lead-1" }));
const mutateActividad = vi.fn(async () => ({ id: "act-1" }));

vi.mock("@/features/crm/hooks", () => ({
  useCrearLead: () => ({ mutateAsync, isPending: false }),
  useCrearActividad: () => ({ mutateAsync: mutateActividad, isPending: false }),
  LEAD_ESTADOS_MANUALES: ["Nuevo"] as const,
  LEAD_FUENTES: ["Prospección"] as const,
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "kam@acme.com" } }),
}));
vi.mock("@/features/crm/components/VendedorSelect", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/AvisoLeadDuplicado", () => ({ AvisoLeadDuplicado: () => <div /> }));
const notifyError = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: vi.fn(),
}));

describe("NuevoLeadDialog — Empresa obligatoria inline", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    notifyError.mockClear();
  });

  it("al enviar sin Empresa muestra error junto al campo, sin toast técnico", () => {
    render(<NuevoLeadDialog open onOpenChange={vi.fn()} />);
    // Antes de intentar guardar no hay error prematuro.
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Crear lead/i }));

    const error = screen.getByRole("alert");
    expect(error.textContent).toMatch(/Indica la empresa/i);
    expect(screen.getByLabelText(/Empresa/i)).toHaveAttribute("aria-invalid", "true");
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("al capturar la empresa el error inline desaparece y sí crea el lead", async () => {
    render(<NuevoLeadDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Crear lead/i }));
    expect(screen.getByRole("alert")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Empresa/i), { target: { value: "Naviera Monterrey" } });
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Crear lead/i }));
    await Promise.resolve();
    expect(mutateAsync).toHaveBeenCalled();
  });
});
