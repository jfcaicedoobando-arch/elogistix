import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortalSinCliente } from "../PortalSinCliente";

describe("PortalSinCliente (P-07)", () => {
  it("explica que la cuenta no está vinculada e incluye el correo del usuario", () => {
    render(<PortalSinCliente email="cliente@demo.mx" onSignOut={vi.fn()} />);

    expect(
      screen.getByText(/Tu cuenta aún no está vinculada a una empresa/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/cliente@demo.mx/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contactar a mi ejecutivo/i })).toBeInTheDocument();
  });

  it("permite cerrar sesión", () => {
    const onSignOut = vi.fn();
    render(<PortalSinCliente email={null} onSignOut={onSignOut} />);

    fireEvent.click(screen.getByRole("button", { name: /Cerrar sesión/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
