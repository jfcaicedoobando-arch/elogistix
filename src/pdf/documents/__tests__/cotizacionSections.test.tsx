import { describe, it, expect, vi } from "vitest";
import { SeccionProspecto, SeccionDatosYMercancia, SeccionDimensiones, SeccionResumenRuta } from "../cotizacionSections";
import { render } from "@testing-library/react";
import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";

vi.mock("@/generators/cotizacion/datosGenerales", () => ({
  buildDatosGenerales: () => [["Modo", "Marítimo"]],
  buildMercancia: () => [["Tipo", "FCL"]],
}));

const mockCotizacion = makeCotizacionRow({ es_prospecto: false });

describe("cotizacionSections", () => {
  it.each(["DPU", "DAT"] as const)("%s conserva la regla de flete sin afirmar seguro incluido", (incoterm) => {
    const { container } = render(<SeccionResumenRuta c={makeCotizacionRow({ modo: "Marítimo", incoterm })} />);
    expect(container.textContent).toContain(`Términos ${incoterm}`);
    expect(container.textContent).toContain("únicamente a servicios locales");
    expect(container.textContent).not.toContain("y el seguro");
  });
  it("FAS conserva el literal sin exclusión de flete inventada", () => {
    const { container } = render(<SeccionResumenRuta c={makeCotizacionRow({ modo: "Marítimo", incoterm: "FAS" })} />);
    expect(container.textContent).toContain("FAS");
    expect(container.textContent).not.toContain("únicamente a servicios locales");
  });
  it("DPU aéreo no añade la exclusión marítima", () => {
    const { container } = render(<SeccionResumenRuta c={makeCotizacionRow({ modo: "Aéreo", incoterm: "DPU" })} />);
    expect(container.textContent).not.toContain("únicamente a servicios locales");
  });
  it("SeccionProspecto retorna null cuando es_prospecto=false", () => {
    const { container } = render(<SeccionProspecto c={mockCotizacion} />);
    expect(container.textContent).toBe("");
  });

  it("SeccionProspecto muestra datos de empresa cuando es_prospecto=true", () => {
    const c = makeCotizacionRow({
      es_prospecto: true,
      prospecto_empresa: "Empresa Prospecto",
      prospecto_contacto: "Juan Pérez",
      prospecto_email: "juan@p.com",
      prospecto_telefono: "555-1234",
    });
    const { container } = render(<SeccionProspecto c={c} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Datos del Prospecto");
    expect(text).toContain("Empresa Prospecto");
    expect(text).toContain("Juan Pérez");
    expect(text).toContain("juan@p.com");
  });

  it("SeccionDimensiones para LCL renderiza Dimensiones y total de piezas/volumen", () => {
    const c = makeCotizacionRow({
      modo: "Marítimo",
      tipo_embarque: "LCL",
      piezas: 2,
      volumen_m3: 0.002,
      dimensiones_lcl: [{ piezas: 1, alto_cm: 10, largo_cm: 10, ancho_cm: 10, volumen_m3: 0.001 }],
    });
    const { container } = render(<SeccionDimensiones c={c} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Dimensiones");
    expect(text).toContain("Total piezas");
    expect(text).toContain("Volumen total");
  });

  it("SeccionDatosYMercancia muestra encabezados de Datos Generales y Mercancía", () => {
    const { container } = render(<SeccionDatosYMercancia c={mockCotizacion} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Datos Generales");
    expect(text).toContain("Mercancía");
  });
});
