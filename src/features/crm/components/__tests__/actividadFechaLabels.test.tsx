import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NuevaActividadDialog from "../NuevaActividadDialog";
import QuickCreateActividadDialog from "../quickCreate/QuickCreateActividadDialog";
import { PICKER_AYUDA_TECLADO } from "@/components/ui/picker-mx-shell";

const { crearActividad } = vi.hoisted(() => ({ crearActividad: vi.fn() }));
vi.mock("@/features/crm/hooks", () => ({
  ACTIVIDAD_TIPOS: ["tarea", "llamada"],
  useCrearActividad: () => ({ mutateAsync: crearActividad, isPending: false }),
  useOportunidades: () => ({ data: { data: [{ id: "op-1", nombre: "Oportunidad de prueba" }] } }),
}));
vi.mock("@/features/crm/components/comboboxes/EntidadComboboxCrm", () => ({
  LeadComboboxCrm: () => <div />,
  OportunidadComboboxCrm: () => <div />,
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));

function assertNativeDateLabel(name: string, idPrefix: string): HTMLInputElement {
  const input = screen.getByRole("textbox", { name }) as HTMLInputElement;
  expect(screen.getByLabelText(name)).toBe(input);
  const id = input.id;
  expect(id).toMatch(new RegExp(`^${idPrefix}-`));
  expect(input).not.toHaveAttribute("aria-label");
  const label = screen.getByText(name, { selector: "label" }) as HTMLLabelElement;
  expect(label.htmlFor).toBe(id);
  expect(label.control).toBe(input);
  expect(input.labels).toHaveLength(1);
  return input;
}

// Real dialogs, pickers, labels and Radix help. Business hooks are in-memory;
// these checks neither submit CRM records nor establish browser geometry.
describe("Actividad CRM · etiqueta de fecha asociada al input real", () => {
  it("el formulario completo conserva nombre visible, ayuda y fecha-hora", async () => {
    render(<NuevaActividadDialog open onOpenChange={vi.fn()} fechaInicial="2026-10-13T17:30" />);
    const input = assertNativeDateLabel("Fecha programada", "nueva-actividad-fecha");
    act(() => input.focus());
    const help = await screen.findByRole("tooltip", { name: PICKER_AYUDA_TECLADO });
    expect(input.closest('[role="group"]')).toHaveAttribute("aria-describedby", help.id);
    expect(input).toHaveValue("13/10/2026 17:30");
    expect(crearActividad).not.toHaveBeenCalled();
  });

  it("el alta express conserva nombre visible y la ayuda larga predeterminada", async () => {
    render(<QuickCreateActividadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />);
    const input = assertNativeDateLabel("Fecha", "qc-actividad-fecha");
    const value = input.value;
    act(() => input.focus());
    await screen.findByRole("tooltip", { name: PICKER_AYUDA_TECLADO });
    expect(input).toHaveValue(value);
    expect(crearActividad).not.toHaveBeenCalled();
  });

  it("el error del picker apunta al nuevo id sin perder la etiqueta", () => {
    render(<NuevaActividadDialog open onOpenChange={vi.fn()} />);
    const input = assertNativeDateLabel("Fecha programada", "nueva-actividad-fecha");
    fireEvent.change(input, { target: { value: "311320261730" } });
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", `${input.id}-error`);
    expect(input).toHaveAccessibleDescription("Fecha inválida. Usa DD/MM/AAAA HH:MM.");
    expect(input).toHaveAccessibleName("Fecha programada");
    expect(crearActividad).not.toHaveBeenCalled();
  });

  it("Más campos conserva el borrador y cambia a la etiqueta del formulario completo", () => {
    const onMore = vi.fn();
    const quick = render(<QuickCreateActividadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={onMore} />);
    const input = assertNativeDateLabel("Fecha", "qc-actividad-fecha");
    fireEvent.change(input, { target: { value: "141020261645" } });
    fireEvent.blur(input);
    fireEvent.change(screen.getByLabelText("Asunto *"), { target: { value: "Llamar" } });
    fireEvent.click(screen.getByRole("button", { name: "Más campos →" }));
    expect(onMore).toHaveBeenCalledWith(expect.objectContaining({ asunto: "Llamar", fecha: "2026-10-14T16:45" }));
    quick.unmount();
    render(<NuevaActividadDialog open onOpenChange={vi.fn()} fechaInicial="2026-10-14T16:45" asuntoInicial="Llamar" />);
    expect(assertNativeDateLabel("Fecha programada", "nueva-actividad-fecha")).toHaveValue("14/10/2026 16:45");
    expect(document.getElementById(input.id)).toBeNull();
    expect(crearActividad).not.toHaveBeenCalled();
  });

  it("cerrar y reabrir el formulario completo conserva una única asociación", () => {
    const onOpenChange = vi.fn();
    const dialog = render(<NuevaActividadDialog open onOpenChange={onOpenChange} fechaInicial="2026-10-13T17:30" />);
    const originalId = assertNativeDateLabel("Fecha programada", "nueva-actividad-fecha").id;
    dialog.rerender(<NuevaActividadDialog open={false} onOpenChange={onOpenChange} />);
    expect(document.getElementById(originalId)).toBeNull();
    dialog.rerender(<NuevaActividadDialog open onOpenChange={onOpenChange} fechaInicial="2026-10-14T16:45" />);
    expect(assertNativeDateLabel("Fecha programada", "nueva-actividad-fecha")).toHaveValue("14/10/2026 16:45");
    expect(document.querySelectorAll('input[id^="nueva-actividad-fecha-"]')).toHaveLength(1);
    expect(crearActividad).not.toHaveBeenCalled();
  });
  it("dos formularios completos abiertos mantienen ids y labels de fecha independientes", () => {
    render(<>
      <NuevaActividadDialog open onOpenChange={vi.fn()} fechaInicial="2026-10-13T17:30" />
      <NuevaActividadDialog open onOpenChange={vi.fn()} fechaInicial="2026-10-14T16:45" />
    </>);
    // El diálogo inferior puede estar aria-hidden: se inspeccionan ambas
    // relaciones HTML nativas, sin afirmar qué anuncia un lector de pantalla.
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[id^="nueva-actividad-fecha-"]'));
    expect(inputs).toHaveLength(2);
    expect(new Set(inputs.map((input) => input.id)).size).toBe(2);
    for (const input of inputs) {
      expect(input.labels).toHaveLength(1);
      expect(input.labels?.[0]?.control).toBe(input);
      expect(input.labels?.[0]?.textContent).toBe("Fecha programada");
    }
    expect(crearActividad).not.toHaveBeenCalled();
  });

});
