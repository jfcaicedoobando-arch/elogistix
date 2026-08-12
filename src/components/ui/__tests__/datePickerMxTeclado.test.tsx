/**
 * v13.550.0 — navegación por teclado de `DatePickerMx`:
 *  - el primer Tab cae en el input (no en el icono del calendario);
 *  - `Alt+Flecha abajo` abre el calendario y `Esc` lo cierra;
 *  - se puede teclear `1/3/2026` y el valor ISO sale correcto.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePickerMx } from "@/components/ui/date-picker-mx";

function Campo({ onChange = vi.fn() }: { onChange?: (iso: string) => void }) {
  return (
    <>
      <button type="button">antes</button>
      <DatePickerMx id="f" title="Fecha de pago" value="" onChange={onChange} />
    </>
  );
}

describe("DatePickerMx · teclado", () => {
  it("el primer Tab enfoca el input de fecha", async () => {
    const user = userEvent.setup();
    render(<Campo />);
    await user.click(screen.getByRole("button", { name: "antes" }));
    await user.tab();
    expect(document.activeElement).toBe(document.getElementById("f"));
  });

  it("acepta 1/3/2026 tecleado y emite el ISO", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Campo onChange={onChange} />);
    const input = document.getElementById("f") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("1/3/2026");
    expect(input.value).toBe("01/03/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-01");
  });

  it("Alt+Flecha abajo abre el calendario y Esc lo cierra", async () => {
    const user = userEvent.setup();
    render(<Campo />);
    const input = document.getElementById("f") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
