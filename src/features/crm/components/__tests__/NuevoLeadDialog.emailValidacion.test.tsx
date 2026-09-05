/**
 * Hallazgo CRM: "Nuevo lead" permitía guardar "foo" como correo porque
 * handleSubmit sólo validaba Empresa. Ahora el correo, si viene capturado,
 * debe pasar `emailLooksValid`; vacío + teléfono sigue siendo válido.
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
  LEAD_FUENTES: ["Otro"] as const,
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

const llenar = (label: RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: valor } });

describe("NuevoLeadDialog — validación de correo", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    mutateActividad.mockClear();
  });

  it("con correo inválido muestra error accesible y no crea el lead", () => {
    render(<NuevoLeadDialog open onOpenChange={vi.fn()} />);
    llenar(/Empresa/i, "Acme");
    llenar(/^Correo$/i, "foo");

    const error = screen.getByRole("alert");
    expect(error.textContent).toMatch(/Correo inválido/i);
    expect(screen.getByLabelText(/^Correo$/i)).toHaveAttribute("aria-invalid", "true");

    const crear = screen.getByRole("button", { name: /Crear lead/i }) as HTMLButtonElement;
    expect(crear.disabled).toBe(true);
    fireEvent.click(crear);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("con correo vacío y teléfono capturado sí crea el lead", () => {
    render(<NuevoLeadDialog open onOpenChange={vi.fn()} />);
    llenar(/Empresa/i, "Acme");
    llenar(/Teléfono/i, "5551234567");

    expect(screen.queryByRole("alert")).toBeNull();
    const crear = screen.getByRole("button", { name: /Crear lead/i }) as HTMLButtonElement;
    expect(crear.disabled).toBe(false);
    fireEvent.click(crear);
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ empresa: "Acme", email: "", telefono: "5551234567" }),
    );
  });

  it("con correo válido permite crear", () => {
    render(<NuevoLeadDialog open onOpenChange={vi.fn()} />);
    llenar(/Empresa/i, "Acme");
    llenar(/^Correo$/i, "qa.cliente@gmail.com");

    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Crear lead/i }));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ email: "qa.cliente@gmail.com" }),
    );
  });

  it("si la creación falla no repite el aviso de error (el hook ya notifica)", async () => {
    notifyError.mockClear();
    mutateAsync.mockRejectedValueOnce(new Error("RLS denegado"));
    render(<NuevoLeadDialog open onOpenChange={vi.fn()} />);
    llenar(/Empresa/i, "Acme");

    fireEvent.click(screen.getByRole("button", { name: /Crear lead/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    // El único feedback de error visible lo emite useCrearLead.onError.
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("si el lead se crea pero falla la actividad automática sí avisa (mutación silenciosa)", async () => {
    notifyError.mockClear();
    mutateActividad.mockRejectedValueOnce(new Error("fallo actividad"));
    render(<NuevoLeadDialog open onOpenChange={vi.fn()} />);
    llenar(/Empresa/i, "Acme");

    fireEvent.click(screen.getByRole("button", { name: /Crear lead/i }));

    await waitFor(() =>
      expect(notifyError).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ title: expect.stringMatching(/no se pudo crear la tarea automática/i) }),
      ),
    );
  });
});
