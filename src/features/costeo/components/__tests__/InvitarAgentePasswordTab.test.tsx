import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "@/components/ui/tabs";
import { InvitarAgentePasswordTab } from "../InvitarAgentePasswordTab";

function renderTab(overrides: Partial<Parameters<typeof InvitarAgentePasswordTab>[0]> = {}) {
  const props = {
    email: "",
    password: "",
    showPassword: false,
    onEmailChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onToggleShow: vi.fn(),
    onGenerate: vi.fn(),
    ...overrides,
  };
  render(
    <Tabs value="password">
      <InvitarAgentePasswordTab {...props} />
    </Tabs>,
  );
  return props;
}

describe("InvitarAgentePasswordTab", () => {
  it("dispara onEmailChange al teclear", () => {
    const props = renderTab();
    fireEvent.change(screen.getByPlaceholderText(/contacto@agente/i), {
      target: { value: "x@y.com" },
    });
    expect(props.onEmailChange).toHaveBeenCalledWith("x@y.com");
  });

  it("dispara onPasswordChange al teclear", () => {
    const props = renderTab();
    fireEvent.change(screen.getByPlaceholderText("Contraseña temporal del agente"), { target: { value: "secret12" } });
    expect(props.onPasswordChange).toHaveBeenCalledWith("secret12");
  });

  it("alterna visibilidad y genera contraseña", () => {
    const props = renderTab();
    fireEvent.click(screen.getByLabelText(/mostrar contraseña/i));
    expect(props.onToggleShow).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/generar contraseña/i));
    expect(props.onGenerate).toHaveBeenCalled();
  });

  it("muestra label 'Ocultar' cuando showPassword=true", () => {
    renderTab({ showPassword: true, password: "visible" });
    expect(screen.getByLabelText(/ocultar contraseña/i)).toBeInTheDocument();
  });
});
