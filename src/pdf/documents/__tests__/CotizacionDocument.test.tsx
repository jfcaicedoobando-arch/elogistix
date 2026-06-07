import { describe, it, expect, vi } from "vitest";
import { CotizacionDocument } from "../CotizacionDocument";
import { render } from "@testing-library/react";

const mockCotizacion = {
  folio: "COT-001",
  es_prospecto: false,
  cliente_nombre: "Cliente Test",
  created_at: "2023-01-01T10:00:00Z",
  estado: "Borrador",
  conceptos_venta: [],
  notas: "Alguna nota",
} as any;

describe("CotizacionDocument", () => {
  it("CotizacionDocument renderiza con props mínimas", () => {
    const { getByTestId } = render(<CotizacionDocument cotizacion={mockCotizacion} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar versión prospecto sin errores", () => {
    const prospecto = { ...mockCotizacion, es_prospecto: true, prospecto_empresa: "Empresa P" };
    const { getByTestId } = render(<CotizacionDocument cotizacion={prospecto} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
