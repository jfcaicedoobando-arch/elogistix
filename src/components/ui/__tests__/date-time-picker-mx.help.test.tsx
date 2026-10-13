import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTimePickerMx } from "../date-time-picker-mx";
import { PICKER_AYUDA_TECLADO } from "../picker-mx-shell";

// Geometry requires a real browser; jsdom checks the real Radix help,
// its full accessible copy and the viewport/wrapping constraints reaching it.
describe("DateTimePickerMx · ayuda en pantallas estrechas", () => {
  it.each([
    { title: undefined, label: PICKER_AYUDA_TECLADO },
    { title: "Fecha de pago", label: "Fecha de pago" },
    { title: "FechaLargaSinEspacios".repeat(20), label: "FechaLargaSinEspacios".repeat(20) },
  ])("limita y permite envolver la ayuda: $title", async ({ title, label }) => {
    const onChange = vi.fn();
    render(<div className="whitespace-nowrap">
      <DateTimePickerMx title={title} value="2026-10-13T17:30" onChange={onChange} />
    </div>);
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    const help = await screen.findByRole("tooltip", { name: label });
    expect(help.closest("[data-side]")).toHaveClass(
      "max-w-[min(24rem,calc(100vw-2rem))]", "whitespace-normal", "[overflow-wrap:anywhere]",
    );
    expect(help).toHaveTextContent(label);
    expect(input).toHaveValue("13/10/2026 17:30");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("conserva la ayuda completa al cerrar con Escape y volver a enfocar", async () => {
    const onChange = vi.fn();
    render(<><button type="button">Otro campo</button>
      <DateTimePickerMx value="2026-10-13T17:30" onChange={onChange} /></>);
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    expect(await screen.findByRole("tooltip", { name: PICKER_AYUDA_TECLADO })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Otro campo" }).focus());
    act(() => input.focus());
    expect(await screen.findByRole("tooltip", { name: PICKER_AYUDA_TECLADO })).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
});
