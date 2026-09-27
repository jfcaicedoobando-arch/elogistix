/**
 * UX-04 — el label del FormField queda ligado al control y el error se anuncia.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "@/components/shared/FormField";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";

describe("FormField — accesibilidad", () => {
  it("liga el label y el error al trigger DOM de Radix Select sin perder ayudas", () => {
    render(<>
      <p id="ayuda-select">Elige un tipo</p>
      <FormField label="Tipo de carga" error="Selecciona la carga">
        <Select><SelectTrigger id="carga" aria-describedby="ayuda-select"><SelectValue placeholder="Seleccionar" /></SelectTrigger></Select>
      </FormField>
    </>);
    const trigger = screen.getByRole("combobox", { name: "Tipo de carga" });
    expect(trigger).toHaveAttribute("id", "carga");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "ayuda-select carga-error");
    expect(screen.getByLabelText("Tipo de carga")).toBe(trigger);
  });

  it("asigna un id al trigger sin id en lugar de Select.Root", () => {
    render(<FormField label="Frecuencia"><Select><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></Select></FormField>);
    expect(screen.getByLabelText("Frecuencia")).toHaveAttribute("id");
  });
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
