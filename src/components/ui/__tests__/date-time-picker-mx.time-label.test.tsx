import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateTimePickerMx } from "@/components/ui/date-time-picker-mx";

const INITIAL_VALUE = "2026-10-13T17:30";

function StatefulPicker({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState(INITIAL_VALUE);
  return <DateTimePickerMx value={value} onChange={(next) => {
    setValue(next);
    onChange(next);
  }} />;
}

async function openCalendar(input: HTMLElement) {
  act(() => input.focus());
  fireEvent.keyDown(input, { key: "F4" });
  return screen.findByRole("dialog");
}

function getTime() {
  return screen.getByLabelText<HTMLInputElement>("Hora", { selector: "input" });
}

async function closeFromTime(time: HTMLInputElement, input: HTMLElement) {
  act(() => time.focus());
  fireEvent.keyDown(time, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(input).toHaveFocus();
}

describe("DateTimePickerMx: etiqueta nativa de hora", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 13, 12));
  });

  it.each([undefined, "fecha-programada"])("asocia Hora al input con id externo %s", async (id) => {
    render(<DateTimePickerMx id={id} value={INITIAL_VALUE} onChange={vi.fn()} />);
    await openCalendar(screen.getByRole("textbox"));
    const time = getTime();
    const label = screen.getByText<HTMLLabelElement>("Hora", { selector: "label" });

    expect(time).toHaveAccessibleName("Hora");
    expect(time).toHaveAttribute("type", "time");
    expect(time).not.toHaveAttribute("aria-label");
    expect(time.id).not.toBe("");
    expect(label.htmlFor).toBe(time.id);
    expect(label.control).toBe(time);
    expect(Array.from(time.labels ?? [])).toEqual([label]);
    expect(time.tabIndex).toBe(0);
    expect(label).not.toHaveAttribute("tabindex");
    expect(label.className).toBe("text-body-sm text-muted-foreground");
    expect(time).toHaveClass("h-9", "w-32");
    expect(label.parentElement?.className).toBe("border-t p-3 flex items-center gap-2");

    // jsdom implements native label activation; this is not a browser focus test.
    const activated = vi.fn();
    time.addEventListener("click", activated);
    fireEvent.click(label);
    expect(activated).toHaveBeenCalledOnce();
  });

  it("mantiene el id de hora al reabrir y cambiar el id externo de fecha", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<DateTimePickerMx id="fecha-uno" value={INITIAL_VALUE} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await openCalendar(input);
    const originalId = getTime().id;
    await closeFromTime(getTime(), input);

    rerender(<DateTimePickerMx id="fecha-dos" value={INITIAL_VALUE} onChange={onChange} errorText="Revisa la fecha" />);
    await openCalendar(input);
    const time = getTime();
    expect(time.id).toBe(originalId);
    expect(time).toHaveAccessibleName("Hora");
    expect(input).toHaveAttribute("id", "fecha-dos");
    expect(input).toHaveAttribute("aria-describedby", "fecha-dos-error");
    expect(input).toHaveAccessibleDescription("Revisa la fecha");
    expect(time).not.toHaveAttribute("aria-describedby");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("separa los ids y las etiquetas de dos instancias montadas", async () => {
    const onChange = vi.fn();
    render(<>
      <DateTimePickerMx title="Entrada" value={INITIAL_VALUE} onChange={onChange} />
      <label htmlFor="fecha-salida">Salida</label>
      <DateTimePickerMx id="fecha-salida" value={INITIAL_VALUE} onChange={onChange} />
    </>);
    const first = screen.getByRole("textbox", { name: "Entrada" });
    const second = screen.getByLabelText("Salida");
    await openCalendar(first);
    const firstId = getTime().id;
    expect(screen.getByText<HTMLLabelElement>("Hora").control).toBe(getTime());
    await closeFromTime(getTime(), first);

    await openCalendar(second);
    const secondId = getTime().id;
    expect(secondId).not.toBe(firstId);
    expect(screen.getByText<HTMLLabelElement>("Hora").control).toBe(getTime());
    expect(document.getElementById(firstId)).toBeNull();
    await closeFromTime(getTime(), second);

    await openCalendar(first);
    expect(getTime().id).toBe(firstId);
    expect(screen.getByText<HTMLLabelElement>("Hora").control).toBe(getTime());
    const ids = Array.from(document.querySelectorAll("[id]"), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([{ key: "F4" }, { key: "ArrowDown", altKey: true }])(
    "conserva foco, fecha y actualización de hora desde $key",
    async (key) => {
      const onChange = vi.fn();
      render(<StatefulPicker onChange={onChange} />);
      const input = screen.getByRole("textbox");
      act(() => input.focus());
      fireEvent.keyDown(input, key);
      await screen.findByRole("dialog");
      const time = getTime();
      act(() => time.focus());
      expect(time).toHaveFocus();
      expect(time).toHaveValue("17:30");

      fireEvent.change(time, { target: { value: "08:45" } });
      expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-10-13T08:45");
      expect(time).toHaveValue("08:45");
      expect(input).toHaveValue("13/10/2026 08:45");
      expect(time).toHaveFocus();
      await closeFromTime(time, input);
      expect(input).toHaveValue("13/10/2026 08:45");

      await openCalendar(input);
      expect(getTime()).toHaveValue("08:45");
      expect(onChange).toHaveBeenCalledTimes(1);
    },
  );

  it("conserva la hora al seleccionar otro día y el formato al editar la fecha", async () => {
    const onChange = vi.fn();
    render(<StatefulPicker onChange={onChange} />);
    const input = screen.getByRole("textbox");
    const dialog = await openCalendar(input);
    const nextDay = within(dialog).getByRole("button", { name: /14 de octubre de 2026/i });
    fireEvent.click(nextDay);
    expect(onChange).toHaveBeenLastCalledWith("2026-10-14T17:30");
    expect(getTime()).toHaveValue("17:30");
    expect(input).toHaveValue("14/10/2026 17:30");
    await closeFromTime(getTime(), input);

    fireEvent.change(input, { target: { value: "151020262215" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-10-15T22:15");
    expect(input).toHaveValue("15/10/2026 22:15");
  });
});
