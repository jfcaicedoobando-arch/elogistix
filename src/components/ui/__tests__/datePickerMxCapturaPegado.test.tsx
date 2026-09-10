/**
 * v13.823.290 — captura y pegado de fechas en `DatePickerMx`:
 *  - los separadores `-` y `.` se pueden teclear (antes eran atajos ±1 día);
 *  - se puede teclear la fecha corrida encima de una fecha existente;
 *  - el pegado acepta formatos con hora, año de 2 dígitos o sólo dígitos.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DatePickerMx } from "@/components/ui/date-picker-mx";

function renderCampo(value = "") {
  const onChange = vi.fn();
  render(<DatePickerMx id="f" title="Fecha de pago" value={value} onChange={onChange} />);
  const input = document.getElementById("f") as HTMLInputElement;
  fireEvent.focus(input);
  return { input, onChange };
}

/**
 * Simula teclear carácter por carácter. Al enfocar, el campo queda
 * seleccionado por completo: el primer carácter reemplaza todo el texto.
 */
function teclear(input: HTMLInputElement, texto: string) {
  [...texto].forEach((ch, i) => {
    fireEvent.keyDown(input, { key: ch });
    const base = i === 0 ? "" : input.value;
    fireEvent.change(input, { target: { value: `${base}${ch}` } });
  });
}

function pegar(input: HTMLInputElement, texto: string) {
  fireEvent.paste(input, { clipboardData: { getData: () => texto } });
}

describe("DatePickerMx · captura", () => {
  it("acepta guiones tecleados (13-03-2026)", () => {
    const { input, onChange } = renderCampo();
    teclear(input, "13-03-2026");
    expect(input.value).toBe("13/03/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("acepta puntos tecleados (13.03.2026)", () => {
    const { input, onChange } = renderCampo();
    teclear(input, "13.03.2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("permite teclear corrido encima de una fecha existente", () => {
    const { input, onChange } = renderCampo("2026-01-01");
    expect(input.value).toBe("01/01/2026");
    teclear(input, "13032026");
    expect(input.value).toBe("13/03/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });
});

describe("DatePickerMx · pegado", () => {
  it("pega una fecha ISO con hora", () => {
    const { input, onChange } = renderCampo();
    pegar(input, "2026-03-13T10:00");
    expect(input.value).toBe("13/03/2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("pega DD/M/YY con año de dos dígitos", () => {
    const { input, onChange } = renderCampo();
    pegar(input, "13/3/26");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("pega sólo dígitos (13032026)", () => {
    const { input, onChange } = renderCampo();
    pegar(input, "13032026");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("pega texto con ruido alrededor", () => {
    const { input, onChange } = renderCampo();
    pegar(input, "Vence: 13/03/2026 (viernes)");
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13");
  });

  it("avisa cuando el texto pegado no es una fecha", () => {
    const { input, onChange } = renderCampo();
    pegar(input, "pendiente");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/fecha inválida/i)).toBeInTheDocument();
  });
});
