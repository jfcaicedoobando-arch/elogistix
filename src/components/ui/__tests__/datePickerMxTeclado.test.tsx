/**
 * v13.550.0 — navegación por teclado de `DatePickerMx`:
 *  - el input va primero en el DOM (el Tab no cae en el icono del calendario);
 *  - `Alt+Flecha abajo` abre el calendario;
 *  - se puede teclear `1/3/2026` y el valor ISO sale correcto.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DatePickerMx } from "@/components/ui/date-picker-mx";

function renderCampo(onChange = vi.fn()) {
  render(<DatePickerMx id="f" title="Fecha de pago" value="" onChange={onChange} />);
  return { input: document.getElementById("f") as HTMLInputElement, onChange };
}

describe("DatePickerMx · teclado", () => {
  it("el input aparece antes que los botones auxiliares (orden de tabulación)", () => {
    const { input } = renderCampo();
    const grupo = screen.getByRole("group", { name: "Fecha de pago" });
    expect(grupo.firstElementChild).toBe(input);
    const calendario = screen.getByRole("button", { name: "Abrir calendario" });
    expect(calendario.getAttribute("tabindex")).toBe("-1");
  });

  it("acepta 1/3/2026 tecleado y emite el ISO", () => {
    const { input, onChange } = renderCampo();
    fireEvent.change(input, { target: { value: "1/3/2026" } });
    expect(input.value).toBe("01/03/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-01");
  });

  it("Alt+Flecha abajo abre el calendario", async () => {
    const { input } = renderCampo();
    fireEvent.keyDown(input, { key: "ArrowDown", altKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
