/**
 * Tests del componente compartido DetalleActionBar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FileText, Mail, Stamp, Trash2, Download, Ship, Ban } from "lucide-react";
import { DetalleActionBar, type DetalleActionItem } from "../DetalleActionBar";

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const item = (id: string, label: string, extra: Partial<DetalleActionItem> = {}): DetalleActionItem => ({
  id, label, icon: FileText, onClick: vi.fn(), ...extra,
});

describe("DetalleActionBar", () => {
  it("no renderiza nada cuando todas las listas están vacías", () => {
    const { container } = wrap(<DetalleActionBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza acción primaria como botón sólido", () => {
    const onClick = vi.fn();
    wrap(<DetalleActionBar primary={{ id: "t", label: "Timbrar", icon: Stamp, onClick }} />);
    const btn = screen.getByRole("button", { name: /timbrar/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("empuja al menú 'Más' las secundarias que exceden el máximo de 3 visibles", () => {
    wrap(
      <DetalleActionBar
        secondary={[
          item("a", "PDF", { icon: FileText }),
          item("b", "XML", { icon: FileText }),
          item("c", "Enviar", { icon: Mail }),
          item("d", "Sustituir", { icon: FileText }),
          item("e", "Ver embarque", { icon: Ship }),
        ]}
      />,
    );
    // Los primeros 3 son botones visibles
    expect(screen.getByRole("button", { name: /^PDF$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^XML$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Enviar$/ })).toBeInTheDocument();
    // Los 2 restantes NO están visibles hasta abrir el menú
    expect(screen.queryByRole("button", { name: /^Sustituir$/ })).not.toBeInTheDocument();
    // Botón "Más acciones" existe
    expect(screen.getByRole("button", { name: /más acciones/i })).toBeInTheDocument();
  });

  it("no muestra menú 'Más' cuando no hay overflow ni more items", () => {
    wrap(
      <DetalleActionBar
        secondary={[item("a", "PDF"), item("b", "XML")]}
      />,
    );
    expect(screen.queryByRole("button", { name: /más acciones/i })).not.toBeInTheDocument();
  });

  it("renderiza el botón destructivo separado", () => {
    const onClick = vi.fn();
    wrap(
      <DetalleActionBar
        destructive={{ id: "del", label: "Eliminar borrador", icon: Trash2, onClick }}
      />,
    );
    const btn = screen.getByRole("button", { name: /eliminar borrador/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("respeta loading: ícono spinner y botón deshabilitado", () => {
    wrap(
      <DetalleActionBar
        primary={{ id: "t", label: "Timbrar", icon: Stamp, onClick: vi.fn(), loading: true }}
      />,
    );
    const btn = screen.getByRole("button", { name: /timbrar/i });
    expect(btn).toBeDisabled();
  });

  it("renderiza secundaria con href como Link (no dispara onClick)", () => {
    wrap(
      <DetalleActionBar
        secondary={[{ id: "emb", label: "Ver embarque", icon: Ship, href: "/embarques/123" }]}
      />,
    );
    const link = screen.getByRole("link", { name: /ver embarque/i });
    expect(link).toHaveAttribute("href", "/embarques/123");
  });

  it("propaga onClick a acciones secundarias visibles", () => {
    const onClick = vi.fn();
    wrap(
      <DetalleActionBar
        secondary={[{ id: "x", label: "Cancelar CFDI", icon: Ban, onClick }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar cfdi/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("descargas: acepta iconClassName y no rompe el render", () => {
    wrap(
      <DetalleActionBar
        secondary={[{ id: "p", label: "PDF", icon: Download, iconClassName: "text-destructive", onClick: vi.fn() }]}
      />,
    );
    expect(screen.getByRole("button", { name: /^PDF$/ })).toBeInTheDocument();
  });
});
