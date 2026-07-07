import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PageSkeleton,
  DetailSkeleton,
  DashboardSkeleton,
  KpiGridSkeleton,
  CardSkeleton,
  FieldGridSkeleton,
} from "../index";

describe("skeletons library — a11y", () => {
  it.each([
    ["PageSkeleton", <PageSkeleton />],
    ["DetailSkeleton", <DetailSkeleton />],
    ["DashboardSkeleton", <DashboardSkeleton />],
    ["KpiGridSkeleton", <KpiGridSkeleton />],
    ["CardSkeleton", <CardSkeleton />],
    ["FieldGridSkeleton", <FieldGridSkeleton />],
  ])("%s expone role=status con aria-busy", (_name, element) => {
    render(element);
    const status = screen.getAllByRole("status")[0];
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent(/cargando/i);
  });
});

describe("KpiGridSkeleton", () => {
  it("renderiza el número de tiles pedido", () => {
    const { container } = render(<KpiGridSkeleton count={5} />);
    // 5 skeletons hijos + 1 sr-only span
    expect(container.querySelectorAll("[aria-hidden='true']").length).toBe(5);
  });
});

describe("FieldGridSkeleton", () => {
  it("renderiza N pares label+value", () => {
    const { container } = render(<FieldGridSkeleton fields={4} />);
    // 4 campos × 2 skeletons (label + value) = 8
    expect(container.querySelectorAll("[aria-hidden='true']").length).toBe(8);
  });
});
