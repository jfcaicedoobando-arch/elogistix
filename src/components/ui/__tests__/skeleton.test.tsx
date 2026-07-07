import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, SkeletonGroup } from "../skeleton";

describe("Skeleton primitive", () => {
  it("aplica motion-safe:animate-pulse para respetar prefers-reduced-motion", () => {
    const { container } = render(<Skeleton data-testid="sk" />);
    expect(container.firstChild).toHaveClass("motion-safe:animate-pulse");
  });

  it("es aria-hidden por defecto (el grupo es quien anuncia)", () => {
    render(<Skeleton data-testid="sk" />);
    expect(screen.getByTestId("sk")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SkeletonGroup", () => {
  it("anuncia estado de carga con role=status y aria-busy", () => {
    render(
      <SkeletonGroup>
        <Skeleton />
      </SkeletonGroup>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent(/cargando/i);
  });

  it("permite personalizar el loadingLabel", () => {
    render(<SkeletonGroup loadingLabel="Cargando facturas" />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando facturas");
  });
});
