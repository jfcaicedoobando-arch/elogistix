import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/features/cotizacion/services/envios", () => ({
  esContactoProveedor: (c: { tipo?: string }) =>
    c?.tipo === "proveedor" || c?.tipo === "shipper",
  CLIENTE_PRINCIPAL_ID: "__cliente_principal__",
}));

import { DestinatariosPicker } from "../DestinatariosPicker";

const contactoCliente = {
  id: "c1",
  nombre: "Juan",
  contacto: "Juan",
  email: "juan@cliente.com",
  tipo: "principal",
};
const contactoProveedor = {
  id: "p1",
  nombre: "Prov",
  contacto: "Prov",
  email: "prov@x.com",
  tipo: "proveedor",
};

function make(overrides: Partial<React.ComponentProps<typeof DestinatariosPicker>> = {}) {
  const props = {
    contactos: [contactoCliente, contactoProveedor],
    loadingContactos: false,
    seleccionados: { c1: true },
    onToggle: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<DestinatariosPicker {...props} />) };
}

describe("DestinatariosPicker", () => {
  it("renderiza contactos cliente y oculta proveedores/shippers", () => {
    make();
    expect(screen.getByText("juan@cliente.com")).toBeInTheDocument();
    expect(screen.queryByText("prov@x.com")).not.toBeInTheDocument();
  });

  it("muestra loading y no renderiza cuando la lista está vacía", () => {
    const { unmount } = make({ contactos: [], loadingContactos: true });
    expect(screen.getByText(/Cargando contactos/)).toBeInTheDocument();
    unmount();
    const { container } = make({ contactos: [], loadingContactos: false });
    expect(container).toBeEmptyDOMElement();
  });
});
