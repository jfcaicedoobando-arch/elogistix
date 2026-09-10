import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentoLayout } from "../DocumentoLayout";

describe("DocumentoLayout", () => {
  it("apila el historial de proformas en HD y lo coloca al costado desde 2xl", () => {
    const { container } = render(
      <DocumentoLayout rail={<div>Historial</div>} railBreakpoint="2xl">
        <div>Conceptos</div>
      </DocumentoLayout>,
    );

    const layout = container.firstElementChild;
    expect(layout).toHaveClass("grid-cols-1", "2xl:grid-cols-[1fr_21rem]");
    expect(layout).not.toHaveClass("xl:grid-cols-[1fr_19rem]");
    expect(screen.getByText("Conceptos")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Actividad del documento" }))
      .toHaveTextContent("Historial");
  });

  it("conserva el riel lateral desde xl para los demás documentos", () => {
    const { container } = render(
      <DocumentoLayout rail={<div>Historial</div>}>
        <div>Documento</div>
      </DocumentoLayout>,
    );

    expect(container.firstElementChild).toHaveClass("xl:grid-cols-[1fr_19rem]");
  });
});