import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CxpHeaderActions } from "../CxpHeaderActions";

describe("CxP controles responsive", () => {
  it("permite que las acciones bajen completas bajo el título", () => {
    const { container } = render(
      <MemoryRouter>
        <CxpHeaderActions puedeCapturar puedeExportar onExportar={vi.fn()} onCapturar={vi.fn()} />
      </MemoryRouter>,
    );
    expect(container.firstChild).toHaveClass("w-full", "flex-wrap", "md:w-auto");
    expect(screen.getByRole("button", { name: /Capturar factura/i })).toBeInTheDocument();
  });
});