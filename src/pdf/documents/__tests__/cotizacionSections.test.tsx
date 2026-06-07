import { describe, it, expect, vi } from "vitest";
import { SeccionProspecto, SeccionDatosYMercancia, SeccionDimensiones } from "../cotizacionSections";
import { render } from "@testing-library/react";

vi.mock("@/generators/cotizacion/datosGenerales", () => ({
  buildDatosGenerales: () => [],
  buildMercancia: () => [],
}));

const mockCotizacion = {
  es_prospecto: false,
} as any;

describe("cotizacionSections", () => {
  it("SeccionProspecto no debe renderizar si no es prospecto", () => {
    const { queryByTestId } = render(<SeccionProspecto c={mockCotizacion} />);
    expect(queryByTestId("pdf-text")).toBeNull();
  });

  it("SeccionDimensiones debe renderizar para Marítimo LCL", () => {
    const cot = { ...mockCotizacion, modo: "Marítimo", tipo_embarque: "LCL", dimensiones_lcl: [{ piezas: 1, alto_cm: 10, largo_cm: 10, ancho_cm: 10, volumen_m3: 0.001 }] };
    const { getAllByTestId } = render(<SeccionDimensiones c={cot} />);
    expect(getAllByTestId("pdf-text").length).toBeGreaterThan(0);
  });

  it("SeccionDatosYMercancia debe renderizar sin errores", () => {
    const { getAllByTestId } = render(<SeccionDatosYMercancia c={mockCotizacion} />);
    expect(getAllByTestId("pdf-text").length).toBeGreaterThan(0);
  });
});
