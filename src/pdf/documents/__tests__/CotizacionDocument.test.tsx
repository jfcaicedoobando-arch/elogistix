import { describe, it, expect, vi } from "vitest";
import { CotizacionDocument } from "../CotizacionDocument";
import { render } from "@testing-library/react";

// Mock para evitar errores de renderizado de @react-pdf/renderer en JSDOM
vi.mock("@react-pdf/renderer", async () => {
  const actual = await vi.importActual("@react-pdf/renderer");
  return {
    ...actual as any,
    Document: ({ children }: any) => <div data-testid="pdf-doc">{children}</div>,
    Page: ({ children }: any) => <div data-testid="pdf-page">{children}</div>,
    View: ({ children }: any) => <div data-testid="pdf-view">{children}</div>,
    Text: ({ children }: any) => <div data-testid="pdf-text">{children}</div>,
  };
});

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
  it("debe renderizar sin errores con props mínimas", () => {
    const { getByTestId } = render(<CotizacionDocument cotizacion={mockCotizacion} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar versión prospecto sin errores", () => {
    const prospecto = { ...mockCotizacion, es_prospecto: true, prospecto_empresa: "Empresa P" };
    const { getByTestId } = render(<CotizacionDocument cotizacion={prospecto} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
