/**
 * El modal de captura NO crea proveedores: sólo avisa y manda al módulo de
 * Proveedores con los datos detectados (v13.492.1).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProveedorNoEncontradoAlert } from "../ProveedorNoEncontradoAlert";

describe("ProveedorNoEncontradoAlert", () => {
  it("muestra los datos detectados y no ofrece crear el proveedor aquí", () => {
    render(<ProveedorNoEncontradoAlert rfc="XAXX010101000" nombre="Otro SA" />);
    expect(screen.getByText(/no encontramos a este proveedor/i)).toBeInTheDocument();
    expect(screen.getByText("Otro SA")).toBeInTheDocument();
    expect(screen.getByText("XAXX010101000")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^crear proveedor$/i })).toBeNull();
  });

  it("abre Proveedores en pestaña nueva con el alta prellenada", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ProveedorNoEncontradoAlert rfc="XAXX010101000" nombre="Otro SA" />);
    fireEvent.click(screen.getByRole("button", { name: /dar de alta en proveedores/i }));
    expect(open).toHaveBeenCalledWith(
      "/compras/proveedores?nuevo=1&rfc=XAXX010101000&nombre=Otro+SA",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });
});
