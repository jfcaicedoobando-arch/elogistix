import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageContainer } from "@/components/shared/PageContainer";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";

describe("<PageContainer />", () => {
  it("aplica padding y max-width estándar", () => {
    render(<PageContainer data-testid="pc">child</PageContainer>);
    const el = screen.getByTestId("pc");
    expect(el.className).toMatch(/max-w-screen-2xl/);
    expect(el.className).toMatch(/space-y-6/);
  });

  it("respeta noSpacing", () => {
    render(<PageContainer noSpacing data-testid="pc">child</PageContainer>);
    expect(screen.getByTestId("pc").className).not.toMatch(/space-y-6/);
  });

  it("aplica ancho wide (1720px) cuando width='wide'", () => {
    render(<PageContainer width="wide" data-testid="pc">child</PageContainer>);
    const cls = screen.getByTestId("pc").className;
    expect(cls).toMatch(/max-w-\[1720px\]/);
    expect(cls).not.toMatch(/max-w-screen-2xl/);
  });
});

describe("<LoadingState />", () => {
  it("muestra label por defecto", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
  });
});

describe("<ErrorState />", () => {
  it("muestra título y botón reintentar", () => {
    let called = 0;
    render(<ErrorState title="Ups" onRetry={() => called++} />);
    expect(screen.getByText("Ups")).toBeInTheDocument();
    screen.getByRole("button", { name: /reintentar/i }).click();
    expect(called).toBe(1);
  });

  it("omite el botón cuando no hay onRetry", () => {
    render(<ErrorState title="Ups" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("<ListSkeleton />", () => {
  it("renderiza el número de filas pedido en variante table", () => {
    const { container } = render(<ListSkeleton rows={3} />);
    expect(container.querySelectorAll("[role='status'] > div").length).toBe(3);
  });

  it("cambia layout en variante card", () => {
    const { container } = render(<ListSkeleton rows={2} variant="card" />);
    const root = container.querySelector("[role='status']");
    expect(root?.className).toMatch(/grid/);
  });
});
