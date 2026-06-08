import { describe, it, expect } from "vitest";
import { CotizacionDocument } from "../CotizacionDocument";
import { render } from "@testing-library/react";

const mockCotizacion = {
  folio: "COT-001",
  es_prospecto: false,
  cliente_nombre: "Cliente Acme",
  created_at: "2023-01-01T10:00:00Z",
  estado: "Borrador",
  conceptos_venta: [],
  notas: "Nota interna del cliente",
} as any;

describe("CotizacionDocument", () => {
  it("renderiza folio, cliente y notas del documento", () => {
    const { container, getByTestId } = render(<CotizacionDocument cotizacion={mockCotizacion} />);
    const text = container.textContent ?? "";
    expect(getByTestId("pdf-doc")).toBeInTheDocument();
    expect(text).toContain("COT-001");
    expect(text).toContain("Cliente Acme");
    expect(text).toContain("Borrador");
    expect(text).toContain("Nota interna del cliente");
    expect(text).toContain("Cotización");
  });

  it("modo prospecto muestra el nombre con sufijo (Prospecto) y oculta cliente_nombre", () => {
    const prospecto = {
      ...mockCotizacion,
      es_prospecto: true,
      prospecto_empresa: "Empresa Prospecto SA",
    };
    const { container } = render(<CotizacionDocument cotizacion={prospecto} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Empresa Prospecto SA");
    expect(text).toContain("(Prospecto)");
  });
});
