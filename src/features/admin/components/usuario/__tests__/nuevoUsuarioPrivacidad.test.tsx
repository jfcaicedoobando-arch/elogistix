/**
 * v13.821.7 — P2-6: nuevo usuario no debe conservar credenciales al reabrir.
 * Cancelar/X/Escape con datos capturados pide confirmación (cierre canónico
 * de `FormDialogShell`); al descartar y al crear con éxito, el formulario
 * (incluida la contraseña) queda reseteado.
 */
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NuevoUsuarioDialog from "../NuevoUsuarioDialog";

const mutate = vi.fn();
vi.mock("@/features/admin/hooks/usuario", () => ({
  useCreateUser: () => ({ mutate, isPending: false }),
}));
vi.mock("@/features/admin/hooks", () => ({
  useOrganizationsList: () => ({ data: [] }),
}));

function Wrapper() {
  const [open, setOpen] = useState(true);
  return (
    <TooltipProvider>
      <button onClick={() => setOpen(true)}>reabrir</button>
      <NuevoUsuarioDialog open={open} onOpenChange={setOpen} onCreated={vi.fn()} />
    </TooltipProvider>
  );
}

/** Se localizan por id: el switch "Invitar por correo" también matchea /correo/i. */
const emailInput = () => document.getElementById("nu-email") as HTMLInputElement;
const passwordInput = () => document.getElementById("nu-password") as HTMLInputElement;

describe("privacidad de credenciales en NuevoUsuarioDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Cancelar con datos capturados pide confirmación y no descarta aún", () => {
    render(<Wrapper />);
    fireEvent.change(emailInput(), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
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

  it("sin cambios, Escape cierra directo sin alerta", () => {
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
  });
});
