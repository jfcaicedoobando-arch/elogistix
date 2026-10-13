import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";

const INITIAL_VALUE = "2026-10-13T17:30";
const SELECTED_TODAY = "Hoy, martes, 13 de octubre de 2026, seleccionado";

function StatefulPicker({ onChange, initialValue = INITIAL_VALUE }: {
  onChange: (value: string) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return <DateTimePickerMx value={value} onChange={(next) => {
    setValue(next);
    onChange(next);
  }} />;
}

async function openCalendar(input: HTMLElement, key = { key: "F4" }) {
  act(() => input.focus());
  fireEvent.keyDown(input, key);
  return within(await screen.findByRole("dialog"));
}

describe("DateTimePickerMx: calendario en español", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 13, 12));
  });

  it.each([{ key: "F4" }, { key: "ArrowDown", altKey: true }])(
    "abre con $key y traduce navegación, hoy y selección sin cambiar el valor",
    async (key) => {
      const onChange = vi.fn();
      render(<StatefulPicker onChange={onChange} />);
      const input = screen.getByRole("textbox");
      const calendar = await openCalendar(input, key);
      expect(calendar.getByRole("navigation", { name: "Barra de navegación" })).toBeInTheDocument();
      expect(calendar.getByRole("button", { name: "Ir al mes anterior" })).toBeInTheDocument();
      expect(calendar.getByRole("button", { name: "Ir al mes siguiente" })).toBeInTheDocument();
      expect(calendar.getByRole("grid", { name: "octubre 2026" })).toBeInTheDocument();
      expect(calendar.getByRole("button", { name: SELECTED_TODAY }).closest("td"))
        .toHaveAttribute("aria-selected", "true");
      expect(calendar.getByRole("button", { name: "miércoles, 14 de octubre de 2026" }))
        .toBeInTheDocument();
      expect(calendar.getByLabelText("Hora", { selector: "input" })).toHaveValue("17:30");
      expect(input).toHaveValue("13/10/2026 17:30");
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("conserva nombres españoles y fecha/hora al navegar entre meses", async () => {
    const onChange = vi.fn();
    render(<StatefulPicker onChange={onChange} />);
    const input = screen.getByRole("textbox");
    const calendar = await openCalendar(input);
    fireEvent.click(calendar.getByRole("button", { name: "Ir al mes siguiente" }));
    expect(calendar.getByRole("grid", { name: "noviembre 2026" })).toBeInTheDocument();
    expect(calendar.getByRole("button", { name: "domingo, 15 de noviembre de 2026" }))
      .toBeInTheDocument();
    fireEvent.click(calendar.getByRole("button", { name: "Ir al mes anterior" }));
    expect(calendar.getByRole("button", { name: SELECTED_TODAY })).toBeInTheDocument();
    expect(input).toHaveValue("13/10/2026 17:30");
    expect(calendar.getByLabelText("Hora", { selector: "input" })).toHaveValue("17:30");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("mantiene flechas, avance de página y selección sin emitir cambios", async () => {
    const onChange = vi.fn();
    render(<StatefulPicker onChange={onChange} />);
    const calendar = await openCalendar(screen.getByRole("textbox"));
    const selected = calendar.getByRole("button", { name: SELECTED_TODAY });
    expect(selected).toHaveFocus();
    fireEvent.keyDown(selected, { key: "ArrowRight" });
    const next = calendar.getByRole("button", { name: "miércoles, 14 de octubre de 2026" });
    expect(next).toHaveFocus();
    fireEvent.keyDown(next, { key: "ArrowDown" });
    const nextWeek = calendar.getByRole("button", { name: "miércoles, 21 de octubre de 2026" });
    expect(nextWeek).toHaveFocus();
    fireEvent.keyDown(nextWeek, { key: "PageDown" });
    const nextMonth = calendar.getByRole("button", { name: "sábado, 21 de noviembre de 2026" });
    expect(nextMonth).toHaveFocus();
    fireEvent.keyDown(nextMonth, { key: "PageUp" });
    expect(calendar.getByRole("button", { name: "miércoles, 21 de octubre de 2026" })).toHaveFocus();
    expect(calendar.getByRole("button", { name: SELECTED_TODAY }).closest("td"))
      .toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox")).toHaveValue("13/10/2026 17:30");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("conserva hora, ID nativo y foco al elegir fecha, editar hora y reabrir", async () => {
    const onChange = vi.fn();
    render(<StatefulPicker onChange={onChange} />);
    const input = screen.getByRole("textbox");
    const calendar = await openCalendar(input);
    // La expectativa inicial también detecta la pérdida del locale de DayPicker.
    expect(calendar.getByRole("button", { name: SELECTED_TODAY })).toBeInTheDocument();
    const time = calendar.getByLabelText<HTMLInputElement>("Hora", { selector: "input" });
    const timeId = time.id;
    expect(calendar.getByText<HTMLLabelElement>("Hora", { selector: "label" }).control).toBe(time);
    fireEvent.click(calendar.getByRole("button", { name: "miércoles, 14 de octubre de 2026" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-14T17:30");
    expect(input).toHaveValue("14/10/2026 17:30");
    expect(calendar.getByRole("button", { name: "miércoles, 14 de octubre de 2026, seleccionado" }))
      .toBeInTheDocument();
    act(() => time.focus());
    fireEvent.change(time, { target: { value: "08:45" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-10-14T08:45");
    expect(time).toHaveFocus();
    fireEvent.keyDown(time, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(input).toHaveFocus();
    const reopened = await openCalendar(input);
    expect(reopened.getByLabelText("Hora", { selector: "input" })).toHaveAttribute("id", timeId);
    expect(reopened.getByLabelText("Hora", { selector: "input" })).toHaveValue("08:45");
    expect(reopened.getByRole("button", { name: "miércoles, 14 de octubre de 2026, seleccionado" }))
      .toBeInTheDocument();
    expect(input).toHaveValue("14/10/2026 08:45");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("localiza hoy sin selección y mantiene la hora predeterminada al elegir", async () => {
    const onChange = vi.fn();
    render(<StatefulPicker initialValue="" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    const calendar = await openCalendar(input);
    expect(calendar.getByRole("button", { name: "Hoy, martes, 13 de octubre de 2026" }))
      .toBeInTheDocument();
    expect(input).toHaveValue("");
    fireEvent.click(calendar.getByRole("button", { name: "miércoles, 14 de octubre de 2026" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-14T09:00");
    expect(input).toHaveValue("14/10/2026 09:00");
  });
});
