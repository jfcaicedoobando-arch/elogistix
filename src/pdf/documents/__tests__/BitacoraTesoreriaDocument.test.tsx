import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BitacoraTesoreriaDocument } from "../BitacoraTesoreriaDocument";

describe("BitacoraTesoreriaDocument: identidad y alcance", () => {
  it("conserva filtros y contexto sin inventar empresa o logo", () => {
    const { container, queryByTestId } = render(<BitacoraTesoreriaDocument
      folio="FP-123" proveedor="Proveedor sintético" filtrosAplicados="Sólo pagos cancelados"
      filas={[]} emisor={{ razonSocial: "Empresa" }} />);
    expect(container).toHaveTextContent("Bitácora de tesorería");
    expect(container).toHaveTextContent("Factura FP-123 · Proveedor sintético");
    expect(container).toHaveTextContent("Sólo pagos cancelados");
    expect(container).toHaveTextContent("No hay movimientos de tesorería para mostrar con los filtros seleccionados.");
    expect(container).toHaveTextContent("0 movimientos incluidos en este reporte.");
    expect(container).toHaveTextContent("Documento interno");
    expect(container).not.toHaveTextContent("RFC:");
    expect(queryByTestId("pdf-image")).not.toBeInTheDocument();
  });

  it("muestra la identidad configurada sin necesitar un logo", () => {
    const { container, queryByTestId } = render(<BitacoraTesoreriaDocument
      folio="FP-123" filas={[]}
      emisor={{ razonSocial: "Operadora Sintética SA", rfc: "AAA010101AAA" }} />);
    expect(container).toHaveTextContent("Operadora Sintética SA");
    expect(container).not.toHaveTextContent("Documento interno");
    expect(queryByTestId("pdf-image")).not.toBeInTheDocument();
  });
});
