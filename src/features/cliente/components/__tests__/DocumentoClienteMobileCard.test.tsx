import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentoClienteMobileCard } from "../DocumentoClienteMobileCard";
import type { DocumentoCliente } from "@/features/cliente/domain/documentosCliente";

function documento(overrides: Partial<DocumentoCliente> = {}): DocumentoCliente {
  return {
    id: "d1", cliente_id: "c1", tipo: "Contrato de servicios", nombre: "contrato.pdf",
    archivo: "path/contrato.pdf", mime_type: "application/pdf", tamano_bytes: 1024,
    fecha_documento: "2024-01-01", fecha_vencimiento: null, notas: null,
    created_at: "2024-01-01",
    ...overrides,
  };
}

describe("DocumentoClienteMobileCard", () => {
  it("muestra tipo y nombre del documento", () => {
    render(<DocumentoClienteMobileCard doc={documento()} onDescargar={vi.fn()} />);
    expect(screen.getByText("Contrato de servicios")).toBeInTheDocument();
    expect(screen.getByText("contrato.pdf")).toBeInTheDocument();
  });
});
