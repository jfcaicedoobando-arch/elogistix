import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeccionProveedorEntrante } from "../SeccionProveedorEntrante";

vi.mock("../SelectorProveedorEntrante", () => ({
  SelectorProveedorEntrante: ({ onInteract }: { onInteract?: () => void }) => (
    <button type="button" onClick={onInteract}>Selecciona el proveedor…</button>
  ),
}));

describe("SeccionProveedorEntrante", () => {
  it("muestra una sola ayuda neutra al abrir y el requerido tras interactuar", () => {
    render(
      <SeccionProveedorEntrante
        embarqueId="emb-1" seleccionado={null} detectado={null}
        rfcEmisor={null} tieneXml={false} onSeleccionar={vi.fn()}
      />,
    );
    expect(screen.getByText(/Elige el proveedor/i)).toBeInTheDocument();
    expect(screen.queryByText(/Selecciona el proveedor para poder enviar/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Selecciona el proveedor/i }));
    expect(screen.queryByText(/Elige el proveedor/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Selecciona el proveedor para poder enviar/i)).toBeInTheDocument();
  });
});