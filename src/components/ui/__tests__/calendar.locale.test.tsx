import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "@/components/ui/calendar";
import { DatePickerMx } from "@/components/ui/date-picker-mx";

const hoy = new Date(2026, 9, 13);
const fechaSeleccionada = "martes, 13 de octubre de 2026, seleccionado";

describe("Calendar · nombres accesibles en español", () => {
  it("localiza navegación, selectores, semana, hoy y selección con el locale oficial", () => {
    render(<Calendar mode="single" selected={hoy} onSelect={vi.fn()} today={hoy}
      defaultMonth={hoy} captionLayout="dropdown" showWeekNumber />);

    expect(screen.getByRole("navigation", { name: "Barra de navegación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir al mes anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir al mes siguiente" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Elegir el mes" })).toHaveValue("9");
    expect(screen.getByRole("combobox", { name: "Elegir el año" })).toHaveValue("2026");
    expect(screen.getByRole("grid", { name: "octubre 2026" })).toBeInTheDocument();
    // DayPicker oculta la cabecera semanal a lectores de pantalla: el nombre
    // completo del día se anuncia en cada botón de fecha.
    const cabecera = screen.getByRole("grid").querySelector("thead");
    expect(cabecera).toHaveAttribute("aria-hidden", "true");
    expect(cabecera?.querySelector('[aria-label="lunes"]')).toHaveTextContent("lu");
    expect(cabecera?.querySelector('[aria-label="Número de semana"]')).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Semana 42" })).toBeInTheDocument();
    const seleccionado = screen.getByRole("button", { name: `Hoy, ${fechaSeleccionada}` });
    expect(seleccionado.closest("td")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "miércoles, 14 de octubre de 2026" })).toBeInTheDocument();
  });

  it("mantiene los labels españoles al cambiar y regresar de mes", () => {
    render(<Calendar mode="single" defaultMonth={hoy} today={hoy} />);
    fireEvent.click(screen.getByRole("button", { name: "Ir al mes siguiente" }));
    expect(screen.getByRole("grid", { name: "noviembre 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "domingo, 15 de noviembre de 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ir al mes anterior" }));
    expect(screen.getByRole("button", { name: "Hoy, martes, 13 de octubre de 2026" })).toBeInTheDocument();
  });

  it("conserva flechas y avance de página sin cambiar la fecha seleccionada", () => {
    const onSelect = vi.fn();
    render(<Calendar mode="single" selected={hoy} onSelect={onSelect} today={hoy}
      defaultMonth={hoy} autoFocus />);
    const seleccionado = screen.getByRole("button", { name: `Hoy, ${fechaSeleccionada}` });
    expect(seleccionado).toHaveFocus();
    fireEvent.keyDown(seleccionado, { key: "ArrowRight" });
    const siguiente = screen.getByRole("button", { name: "miércoles, 14 de octubre de 2026" });
    expect(siguiente).toHaveFocus();
    fireEvent.keyDown(siguiente, { key: "ArrowDown" });
    const semana = screen.getByRole("button", { name: "miércoles, 21 de octubre de 2026" });
    expect(semana).toHaveFocus();
    fireEvent.keyDown(semana, { key: "PageDown" });
    const mes = screen.getByRole("button", { name: "sábado, 21 de noviembre de 2026" });
    expect(mes).toHaveFocus();
    fireEvent.keyDown(mes, { key: "PageUp" });
    expect(screen.getByRole("button", { name: "miércoles, 21 de octubre de 2026" })).toHaveFocus();
    expect(screen.getByRole("button", { name: `Hoy, ${fechaSeleccionada}` }).closest("td"))
      .toHaveAttribute("aria-selected", "true");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("respeta un label personalizado sin perder las otras traducciones", () => {
    render(<Calendar mode="single" defaultMonth={hoy} labels={{ labelNext: () => "Mes posterior" }} />);
    expect(screen.getByRole("button", { name: "Mes posterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir al mes anterior" })).toBeInTheDocument();
  });
});

describe("DatePickerMx · calendario localizado", () => {
  it("abre con teclado, conserva español y emite la misma fecha ISO al elegir", async () => {
    const onChange = vi.fn();
    render(<DatePickerMx value="2026-10-13" onChange={onChange} aria-label="Fecha de pago" />);
    const input = screen.getByRole("textbox", { name: "Fecha de pago" });
    expect(input).toHaveValue("13/10/2026");
    act(() => input.focus());
    fireEvent.keyDown(input, { key: "ArrowDown", altKey: true });
    const calendario = within(await screen.findByRole("dialog"));
    expect(calendario.getByRole("button", { name: "Ir al mes anterior" })).toBeInTheDocument();
    expect(calendario.getByRole("button", { name: "Ir al mes siguiente" })).toBeInTheDocument();
    expect(calendario.getByRole("combobox", { name: "Elegir el mes" })).toBeInTheDocument();
    const seleccionado = calendario.getByRole("button", { name: new RegExp(`${fechaSeleccionada}$`) });
    act(() => seleccionado.focus());
    fireEvent.keyDown(seleccionado, { key: "ArrowRight" });
    const siguiente = calendario.getByRole("button", { name: /miércoles, 14 de octubre de 2026$/ });
    expect(siguiente).toHaveFocus();
    fireEvent.click(siguiente);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-14");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveValue("14/10/2026");
  });

  it("F4 cierra y reabre desde el input sin alterar el valor ISO", async () => {
    const onChange = vi.fn();
    render(<DatePickerMx value="2026-10-13" onChange={onChange} aria-label="Fecha de pago" />);
    const input = screen.getByRole("textbox", { name: "Fecha de pago" });
    fireEvent.keyDown(input, { key: "F4" });
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Ir al mes siguiente" }));
    fireEvent.keyDown(input, { key: "F4" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveValue("13/10/2026");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "F4" });
    expect(within(await screen.findByRole("dialog")).getByRole("button", {
      name: new RegExp(`${fechaSeleccionada}$`),
    })).toBeInTheDocument();
  });
});
