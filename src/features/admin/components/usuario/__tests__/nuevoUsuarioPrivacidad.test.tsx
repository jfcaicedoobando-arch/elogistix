/**
 * v13.821.7 — P2-6: nuevo usuario no debe conservar credenciales al reabrir.
 * Cancelar/X/Escape con datos capturados pide confirmación (cierre canónico
 * de `FormDialogShell`); al descartar y al crear con éxito, el formulario
 * (incluida la contraseña) queda reseteado.
 */
import { useState } from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NuevoUsuarioDialog from "../NuevoUsuarioDialog";
import { PASSWORD_MIN } from "@/lib/passwords/policy";

const mutate = vi.fn();
let organizations: { id: string; nombre: string }[] = [];
vi.mock("@/features/admin/hooks/usuario", () => ({
  useCreateUser: () => ({ mutate, isPending: false }),
}));
vi.mock("@/features/admin/hooks", () => ({
  useOrganizationsList: () => ({ data: organizations }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));

function Wrapper({ showOrgSelector = false }: { showOrgSelector?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <TooltipProvider>
      <button onClick={() => setOpen(true)}>reabrir</button>
      <NuevoUsuarioDialog open={open} onOpenChange={setOpen} onCreated={vi.fn()} showOrgSelector={showOrgSelector} />
    </TooltipProvider>
  );
}

/** Se localizan por id: el switch "Invitar por correo" también matchea /correo/i. */
const emailInput = () => document.getElementById("nu-email") as HTMLInputElement;
const passwordInput = () => document.getElementById("nu-password") as HTMLInputElement;

describe("privacidad de credenciales en NuevoUsuarioDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutate.mockReset();
    organizations = [];
  });

  it("Cancelar con datos capturados pide confirmación y no descarta aún", async () => {
    render(<Wrapper />);
    await act(async () => {
      fireEvent.change(emailInput(), { target: { value: "a@b.com" } });
      fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    });
    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();
    expect(emailInput()).toHaveValue("a@b.com");
  });

  it("al descartar, el email y la contraseña quedan vacíos (no sobreviven al reabrir)", () => {
    render(<Wrapper />);
    fireEvent.change(emailInput(), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("switch")); // revela el campo de contraseña
    fireEvent.change(passwordInput(), { target: { value: "SecretaZ123" } });

    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^descartar$/i }));

    fireEvent.click(screen.getByRole("button", { name: /reabrir/i }));
    expect(emailInput()).toHaveValue("");
    fireEvent.click(screen.getByRole("switch"));
    expect(passwordInput()).toHaveValue("");
  });

  it("alta de usuario sin cambios: Escape cierra directo sin alerta", () => {
    render(<Wrapper />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
  });

  it("tras crear con éxito, el formulario queda reseteado (contraseña no persiste)", async () => {
    mutate.mockImplementation((_vars, { onSuccess }) => onSuccess());
    render(<Wrapper />);
    fireEvent.change(emailInput(), { target: { value: "nuevo@x.com" } });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.change(passwordInput(), { target: { value: "OtraSecreta1" } });

    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /reabrir/i }));
    expect(emailInput()).toHaveValue("");
    expect(screen.getByRole("switch")).toBeChecked();
    fireEvent.click(screen.getByRole("switch"));
    expect(passwordInput()).toHaveValue("");
    expect(passwordInput()).toHaveAttribute("type", "password");
  });

  it("invita sin contraseña y normaliza el correo del usuario", async () => {
    render(<Wrapper />);
    fireEvent.change(emailInput(), { target: { value: "NUEVO@EMPRESA.COM" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar invitación/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(
      { email: "nuevo@empresa.com", password: undefined, role: "customer_service", orgId: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    ));
  });

  it("impide crear con contraseña corta, pero permite volver a invitar", async () => {
    render(<Wrapper />);
    fireEvent.change(emailInput(), { target: { value: "nuevo@empresa.com" } });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.change(passwordInput(), { target: { value: "corta" } });
    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));
    await waitFor(() => expect(screen.getByText(`Mínimo ${PASSWORD_MIN} caracteres`)).toBeInTheDocument());
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: /enviar invitación/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0].password).toBeUndefined();
  });

  it("volver al valor inicial permite cancelar sin confirmación", () => {
    render(<Wrapper />);
    fireEvent.change(emailInput(), { target: { value: "nuevo@empresa.com" } });
    fireEvent.change(emailInput(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(screen.queryByText("¿Descartar los cambios?")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("el catálogo de organizaciones tardío no sobrescribe las credenciales editadas", () => {
    const { rerender } = render(<Wrapper showOrgSelector />);
    fireEvent.change(emailInput(), { target: { value: "nuevo@empresa.com" } });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.change(passwordInput(), { target: { value: "TemporalSegura123" } });
    organizations = [{ id: "org-1", nombre: "Organización de prueba" }];
    rerender(<Wrapper showOrgSelector />);
    expect(emailInput()).toHaveValue("nuevo@empresa.com");
    expect(passwordInput()).toHaveValue("TemporalSegura123");
    expect(screen.getByRole("switch")).not.toBeChecked();
  });
});
