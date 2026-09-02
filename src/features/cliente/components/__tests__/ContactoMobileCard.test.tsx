import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactoMobileCard } from "../ContactoMobileCard";
import type { Tables } from "@/types/db";

function contacto(overrides: Partial<Tables<'contactos_cliente'>> = {}): Tables<'contactos_cliente'> {
  return {
    id: "ct1", cliente_id: "c1", organization_id: "o1", nombre: "Juan Pérez",
    tipo: "Exportador", pais: "México", ciudad: "CDMX", contacto: "Juan",
    email: "juan@acme.mx", telefono: null, created_at: "2024-01-01",
    ...overrides,
  } as Tables<'contactos_cliente'>;
}

describe("ContactoMobileCard", () => {
  it("muestra nombre, tipo y lugar", () => {
    render(
      <ContactoMobileCard contacto={contacto()} canEdit={true} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Exportador")).toBeInTheDocument();
  });
});
