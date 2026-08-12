/**
 * UX-04 — el label del FormField queda ligado al control y el error se anuncia.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "@/components/shared/FormField";

describe("FormField — accesibilidad", () => {
  it("liga el label con el input generando un id", () => {
    render(
      <FormField label="Cliente">
        <input />
      </FormField>,
    );
    const input = screen.getByLabelText("Cliente");
    expect(input).toBeInTheDocument();
  });

  it("respeta un id existente del hijo", () => {
    render(
      <FormField label="Referencia">
        <input id="mi-input" />
      </FormField>,
    );
    expect(screen.getByLabelText("Referencia")).toHaveAttribute("id", "mi-input");
  });

  it("marca aria-invalid y describe el error", () => {
    render(
      <FormField label="Monto" error="Captura el monto">
        <input />
      </FormField>,
    );
    const input = screen.getByLabelText("Monto");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      "Captura el monto",
    );
  });
});
