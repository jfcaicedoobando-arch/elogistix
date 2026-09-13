import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/shared/PageHeader";

describe("<PageHeader />", () => {
  it("renderiza title y description como h1 + p", () => {
    render(<PageHeader title="Clientes" description="Gestión de clientes" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Clientes");
    expect(screen.getByText("Gestión de clientes")).toBeInTheDocument();
  });

  it("renderiza icon y actions cuando se pasan", () => {
    render(
      <PageHeader
        title="X"
        icon={<span data-testid="icon">i</span>}
        actions={<button type="button">Nuevo</button>}
      />,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo" })).toBeInTheDocument();
  });

  it("renderiza slots subHeader y tabs", () => {
    render(
      <PageHeader
        title="X"
        subHeader={<div>chip-sub</div>}
        tabs={<div>tabs-slot</div>}
      />,
    );
    expect(screen.getByText("chip-sub")).toBeInTheDocument();
    expect(screen.getByText("tabs-slot")).toBeInTheDocument();
  });

  it("omite description cuando no se pasa", () => {
    const { container } = render(<PageHeader title="X" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("permite que las acciones envuelvan en lg+ sin truncar el título (v13.823.26)", () => {
    const { container } = render(
      <PageHeader
        title="Cotizaciones (128)"
        description="128 cotizaciones encontradas"
        actions={
          <>
            <button type="button">Exportar</button>
            <button type="button">Nueva cotización</button>
          </>
        }
      />,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    // El título completo (incluido el contador) sigue en el DOM: sólo se recorta
    // visualmente vía CSS `truncate`, nunca por contenido.
    expect(h1).toHaveTextContent("Cotizaciones (128)");
    // El contenedor raíz de título+acciones debe permitir envolver en lg+ para
    // que las acciones bajen de línea antes de truncar el título.
    const row = container.querySelector("div.flex.flex-row");
    expect(row?.className).toContain("lg:flex-wrap");
    expect(screen.getByRole("button", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva cotización" })).toBeInTheDocument();
  });
});
