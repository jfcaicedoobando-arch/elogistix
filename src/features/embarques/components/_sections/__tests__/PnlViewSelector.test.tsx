import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PnlViewSelector } from "../PnlViewSelector";

describe("PnlViewSelector", () => {
  it("no ofrece Por contenedor cuando no hay contenedores operativos", () => {
    render(<PnlViewSelector visible={false} value="global" onChange={vi.fn()} />);
    expect(screen.queryByRole("radio", { name: "Vista por contenedor" })).toBeNull();
  });

  it("mantiene Por contenedor disponible cuando sí existen", () => {
    render(<PnlViewSelector visible value="global" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Vista por contenedor" })).toBeTruthy();
  });
});