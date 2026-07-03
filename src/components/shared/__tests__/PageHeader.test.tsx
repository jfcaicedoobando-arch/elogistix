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
});
