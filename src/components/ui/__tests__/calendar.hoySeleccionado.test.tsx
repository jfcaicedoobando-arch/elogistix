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

function celdaDe(boton: HTMLElement): HTMLElement {
  const celda = boton.closest("td, [role='gridcell']");
  if (!(celda instanceof HTMLElement)) throw new Error("El día no está dentro de una celda");
  return celda;
}

describe("Calendar — hoy vs seleccionado", () => {
  it("marca la selección en la celda, no en el botón (el guard mira la celda)", () => {
    const hoy = new Date();
    const { container } = render(<Calendar mode="single" selected={hoy} month={hoy} />);
    const botonHoy = container.querySelector<HTMLElement>("button[data-day]") ?? undefined;
    expect(botonHoy).toBeTruthy();

    const seleccionada = container.querySelector<HTMLElement>(
      "[aria-selected='true'], [data-selected='true']",
    );
    expect(seleccionada, "react-day-picker debe marcar la celda seleccionada").toBeTruthy();
    // El botón no lleva el estado: por eso el guard anterior nunca aplicaba.
    expect(seleccionada?.tagName.toLowerCase()).not.toBe("button");

    // Hoy seleccionado: la celda SÍ está seleccionada, así que el guard la excluye.
    const celdaHoy = celdaDe(seleccionada!.querySelector("button") ?? seleccionada!);
    expect(celdaHoy.matches(GUARD_NO_SELECCIONADO)).toBe(false);
  });

  it("hoy NO seleccionado sí recibe el énfasis (la celda no está seleccionada)", () => {
    const hoy = new Date();
    const { container } = render(<Calendar mode="single" month={hoy} />);
    const seleccionada = container.querySelector("[aria-selected='true'], [data-selected='true']");
    expect(seleccionada).toBeNull();

    const primerBoton = container.querySelector<HTMLElement>("button[data-day]");
    expect(primerBoton).toBeTruthy();
    expect(celdaDe(primerBoton!).matches(GUARD_NO_SELECCIONADO)).toBe(true);
  });
});
