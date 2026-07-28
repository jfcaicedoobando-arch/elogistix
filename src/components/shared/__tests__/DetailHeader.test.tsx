import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DetailHeader } from "@/components/shared/DetailHeader";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("<DetailHeader />", () => {
  it("renderiza title, subtitle y badge", () => {
    renderInRouter(
      <DetailHeader
        title="Factura A-001"
        subtitle="Cliente: ACME"
        badge={<span data-testid="badge">Timbrada</span>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Factura A-001");
    expect(screen.getByText("Cliente: ACME")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });

  it("botón Volver navega a backTo (número)", async () => {
    navigateMock.mockClear();
    renderInRouter(<DetailHeader title="X" backTo={-1} />);
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  it("botón Volver es un enlace real cuando backTo es una ruta", () => {
    navigateMock.mockClear();
    renderInRouter(<DetailHeader title="X" backTo="/facturacion" />);
    const link = screen.getByRole("link", { name: /volver/i });
    expect(link).toHaveAttribute("href", "/facturacion");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("oculta el botón Volver cuando backTo es null (páginas públicas)", () => {
    renderInRouter(<DetailHeader title="X" backTo={null} />);
    expect(screen.queryByRole("button", { name: /volver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /volver/i })).not.toBeInTheDocument();
  });




  it("renderiza acciones trailing", () => {
    renderInRouter(
      <DetailHeader title="X" trailing={<button type="button">Editar</button>} />,
    );
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("degrada el título a h2 con titleAs", () => {
    renderInRouter(<DetailHeader title="Nova Trading" titleAs="h2" />);
    expect(screen.getByRole("heading", { level: 2, name: "Nova Trading" })).toBeInTheDocument();
  });

  it("expone el título completo en tooltip cuando es texto", () => {
    renderInRouter(<DetailHeader title="Razón social muy larga SA de CV" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute(
      "title",
      "Razón social muy larga SA de CV",
    );
  });
});
