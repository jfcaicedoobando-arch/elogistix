import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandHeader } from "../BrandHeader";
import { Footer } from "../Footer";
import { DataTable } from "../DataTable";
import { statusTextStyle } from "../statusTextStyle";
import { COLORS } from "../../theme/tokens";

describe("identidad y lenguaje visual PDF interno", () => {
  it("respeta nombre comercial y emisor sin confundir sus datos", () => {
    render(<BrandHeader tipoDocumento="Cotización" organizacionNombre="Marca Comercial"
      emisor={{ razonSocial: "Sociedad de Prueba", rfc: "RFC-SINTETICO", logoUrl: "data:image/png;base64,AA==" }} />);
    expect(screen.getByText("Marca Comercial")).toBeInTheDocument();
    expect(screen.getByText("Sociedad de Prueba")).toBeInTheDocument();
    expect(screen.getByText("RFC: RFC-SINTETICO")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-image")).toBeInTheDocument();
  });
  it("logo y datos fiscales ausentes no se sustituyen por los de otra empresa", () => {
    const { container } = render(<><BrandHeader tipoDocumento="Reporte" variant="report" emisor={{ razonSocial: "Empresa" }} /><Footer empresaNombre="Empresa" /></>);
    expect(screen.queryByTestId("pdf-image")).not.toBeInTheDocument();
    expect(screen.getByText("Documento interno")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/RFC|Libre Carga|Empresa/);
  });
  it("explicita la tabla vacía sin inventar importes", () => {
    render(<DataTable columns={[{ key: "value", title: "Valor" }]} rows={[]} />);
    expect(screen.getByText("Sin registros para mostrar.")).toBeInTheDocument();
    expect(screen.queryByText("0.00")).not.toBeInTheDocument();
  });
  it("los estados mantienen texto y sólo agregan una señal de color", () => {
    expect(statusTextStyle("Pagada").color).toBe(COLORS.successFg);
    expect(statusTextStyle("Vencida").color).toBe(COLORS.dangerFg);
    expect(statusTextStyle("Pendiente").color).toBe(COLORS.warningFg);
    expect(statusTextStyle("Estado ajeno").color).toBe(COLORS.primary);
  });
});

it("estado de cuenta conserva los datos del emisor que ya mostraba", () => {
  render(<BrandHeader tipoDocumento="Estado de cuenta" variant="report" emisor={{ razonSocial: "Emisor sintético", rfc: "RFC-SINTETICO", direccion: "Dirección sintética", contacto: "ejemplo@example.test" }} />);
  expect(screen.getByText("RFC: RFC-SINTETICO")).toBeInTheDocument();
  expect(screen.getByText("Dirección sintética")).toBeInTheDocument();
  expect(screen.getByText("ejemplo@example.test")).toBeInTheDocument();
});
