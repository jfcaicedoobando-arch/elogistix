/**
 * REM-VIS-02: el énfasis de "hoy" (aro + texto primary) debe apagarse cuando
 * hoy TAMBIÉN es el día seleccionado, o el texto primary queda sobre el relleno
 * primary. react-day-picker pone `aria-selected`/`data-selected` en la CELDA
 * (gridcell), no en el botón: el guard tiene que evaluarse en la celda.
 *
 * La prueba usa markup REAL del Calendar (no comparación de strings).
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Calendar } from "@/components/ui/calendar";

/** Guard aplicado por `classNames.today` en calendar.tsx. */
const GUARD_NO_SELECCIONADO = ":not([aria-selected='true']):not([data-selected='true'])";
const SELECCIONADO = "[aria-selected='true'], [data-selected='true']";

/** Celda del día cuyo botón muestra ese número. */
function celdaDelDia(container: HTMLElement, dia: number): HTMLElement {
  const boton = Array.from(container.querySelectorAll("button")).find(
    (b) =>
      b.textContent?.trim() === String(dia) &&
      // Los días de relleno del mes anterior/siguiente repiten números.
      !b.closest(".day-outside") &&
      !b.matches("[data-outside='true']"),
  );
  if (!boton) throw new Error(`No se encontró el día ${dia}`);
  const celda = boton.closest("td, [role='gridcell']");
  if (!(celda instanceof HTMLElement)) throw new Error("El día no está dentro de una celda");
  return celda;
}

describe("Calendar — hoy vs seleccionado", () => {
  const hoy = new Date();

  it("con hoy seleccionado, la celda queda marcada y el guard la excluye del énfasis", () => {
    const { container } = render(<Calendar mode="single" selected={hoy} month={hoy} />);
    const celda = celdaDelDia(container, hoy.getDate());

    // El estado de selección vive en la celda, no en el botón: por eso el guard
    // anterior (`[&>button:not([aria-selected='true'])]`) nunca aplicaba.
    expect(celda.matches(SELECCIONADO)).toBe(true);
    expect(celda.querySelector("button")?.matches(SELECCIONADO)).toBe(false);
    expect(celda.matches(GUARD_NO_SELECCIONADO)).toBe(false);
  });

  it("hoy NO seleccionado sí recibe el énfasis (la celda no está seleccionada)", () => {
    const { container } = render(<Calendar mode="single" month={hoy} />);
    const celda = celdaDelDia(container, hoy.getDate());
    expect(celda.matches(SELECCIONADO)).toBe(false);
    expect(celda.matches(GUARD_NO_SELECCIONADO)).toBe(true);
  });
});
