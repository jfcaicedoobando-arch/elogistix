/**
 * v13.823.290 — captura y pegado de fechas en `DatePickerMx`:
 *  - los separadores `-` y `.` se pueden teclear (antes eran atajos ±1 día);
 *  - se puede teclear la fecha corrida encima de una fecha existente;
 *  - el pegado acepta formatos con hora, año de 2 dígitos o sólo dígitos.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePickerMx } from "@/components/ui/date-picker-mx";

function renderCampo(value = "") {
  const onChange = vi.fn();
  render(<DatePickerMx id="f" title="Fecha de pago" value={value} onChange={onChange} />);
  return { input: document.getElementById("f") as HTMLInputElement, onChange };
}

describe("DatePickerMx · captura", () => {
  it("acepta guiones tecleados (13-03-2026)", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderCampo();
    await user.click(input);
    await user.keyboard("13-03-2026");
    expect(input.value).toBe("13/03/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("acepta puntos tecleados (13.03.2026)", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderCampo();
    await user.click(input);
    await user.keyboard("13.03.2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("permite teclear corrido encima de una fecha existente", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderCampo("2026-01-01");
    expect(input.value).toBe("01/01/2026");
    await user.click(input);
    await user.keyboard("13032026");
    expect(input.value).toBe("13/03/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });
});

describe("DatePickerMx · pegado", () => {
  it("pega una fecha ISO con hora", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderCampo();
    await user.click(input);
    await user.paste("2026-03-13T10:00");
    expect(input.value).toBe("13/03/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("pega DD/M/YY con año de dos dígitos", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderCampo();
    await user.click(input);
    await user.paste("13/3/26");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("pega sólo dígitos (13032026)", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderCampo();
    await user.click(input);
    await user.paste("13032026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("pega texto con ruido alrededor", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderCampo();
    await user.click(input);
    await user.paste("Vence: 13/03/2026 (viernes)");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("avisa cuando el texto pegado no es una fecha", async () => {
    const user = userEvent.setup();
    const { input, onChange } = renderCampo();
    await user.click(input);
    await user.paste("pendiente");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/fecha inválida/i)).toBeInTheDocument();
  });
});
