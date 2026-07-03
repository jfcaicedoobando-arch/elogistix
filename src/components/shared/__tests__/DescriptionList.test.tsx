import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DescriptionList } from "@/components/shared/DescriptionList";

describe("<DescriptionList />", () => {
  it("renderiza pares label/valor", () => {
    render(
      <DescriptionList
        items={[
          { label: "RFC", value: "AAA010101AAA", mono: true },
          { label: "Ciudad", value: "Ciudad de México" },
        ]}
      />,
    );
    expect(screen.getByText("RFC")).toBeInTheDocument();
    expect(screen.getByText("AAA010101AAA")).toBeInTheDocument();
    expect(screen.getByText("Ciudad de México")).toBeInTheDocument();
  });

  it("aplica font-mono cuando mono=true", () => {
    render(
      <DescriptionList items={[{ label: "Folio", value: "FP-000123", mono: true }]} />,
    );
    expect(screen.getByText("FP-000123").className).toContain("font-mono");
  });

  it("oculta items vacíos con hideEmpty", () => {
    render(
      <DescriptionList
        items={[
          { label: "A", value: "visible" },
          { label: "B", value: "", hideEmpty: true },
          { label: "C", value: null, hideEmpty: true },
        ]}
      />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).toBeNull();
    expect(screen.queryByText("C")).toBeNull();
  });

  it("usa emptyPlaceholder para valores vacíos sin hideEmpty", () => {
    render(
      <DescriptionList
        items={[{ label: "Tel", value: "" }]}
        emptyPlaceholder="N/A"
      />,
    );
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });
});
