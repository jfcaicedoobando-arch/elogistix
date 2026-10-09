import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntidadesFields } from "../TarifaFormFields";
import { buildInitialForm, calcularErrores } from "../TarifaForm.helpers";

// Only the creation boundary is synthetic; the form and Radix Select are real.
vi.mock("../AgenteProvisionalDialog", () => ({
  AgenteProvisionalDialog: ({ onCreado }: { onCreado: (id: string) => void }) => (
    <button type="button" onClick={() => onCreado("ag-nuevo")}>Crear provisional</button>
  ),
}));
vi.mock("../NavieraQuickCreate", () => ({ NavieraQuickCreate: () => null }));
vi.mock("../MultiRutaSelect", () => ({ MultiRutaSelect: () => null }));

const AGENTE = { id: "ag-existente", nombre: "Agente existente", activo: true };
const NUEVO = { id: "ag-nuevo", nombre: "Agente provisional nuevo", activo: true };

function Fixture({ initialAgente = "" }: { initialAgente?: string }) {
  const [form, setForm] = useState(() => buildInitialForm({ agente_id: initialAgente }));
  const [agentes, setAgentes] = useState([AGENTE]);
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <EntidadesFields
        form={form} setForm={setForm} agentes={agentes} navieras={[]}
        errores={calcularErrores(form, 0, false)}
      />
      <output aria-label="Agente seleccionado">{form.agente_id || "vacio"}</output>
      <button type="button" onClick={() => setAgentes([AGENTE, NUEVO])}>Refrescar agentes</button>
      <button type="button" onClick={() => setForm(buildInitialForm())}>Restablecer formulario</button>
    </form>
  );
}

describe("EntidadesFields: agente provisional con catálogo tardío", () => {
  it.each(["", AGENTE.id])("conserva el id creado antes de la opción (agente previo: %s)", async (initialAgente) => {
    const { container } = render(<Fixture initialAgente={initialAgente} />);
    const trigger = screen.getByRole("combobox", { name: "Agente *" });
    const nativeSelect = container.querySelector("select")!;
    const nativeChange = vi.fn(() => nativeSelect.value);
    nativeSelect.addEventListener("change", nativeChange);

    fireEvent.click(screen.getByRole("button", { name: "Crear provisional" }));
    // Flush Radix's native-select effect while the new option is still absent.
    await act(async () => { await Promise.resolve(); });
    expect(nativeChange).toHaveBeenCalled();
    expect(nativeChange.mock.results.some((result) => result.value === "")).toBe(true);
    expect(nativeSelect.querySelector('option[value="ag-nuevo"]')).toBeNull();
    expect(screen.getByLabelText("Agente seleccionado")).toHaveTextContent("ag-nuevo");
    expect(trigger).not.toHaveAttribute("aria-invalid", "true");

    fireEvent.click(screen.getByRole("button", { name: "Refrescar agentes" }));
    await waitFor(() => expect(trigger).toHaveTextContent(NUEVO.nombre));
    expect(screen.getByLabelText("Agente seleccionado")).toHaveTextContent("ag-nuevo");
    expect(container.querySelector("select")).toHaveValue("ag-nuevo");
    expect(trigger).not.toHaveAttribute("aria-invalid", "true");
  });

  it("permite seleccionar normalmente una opción existente", async () => {
    render(<Fixture />);
    const trigger = screen.getByRole("combobox", { name: "Agente *" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: AGENTE.nombre }));
    await waitFor(() => expect(trigger).toHaveTextContent(AGENTE.nombre));
    expect(screen.getByLabelText("Agente seleccionado")).toHaveTextContent(AGENTE.id);
    expect(trigger).not.toHaveAttribute("aria-invalid", "true");
  });

  it("respeta el reset explícito del padre y vuelve a marcar el agente faltante", async () => {
    render(<Fixture initialAgente={AGENTE.id} />);
    const trigger = screen.getByRole("combobox", { name: "Agente *" });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer formulario" }));
    await waitFor(() => expect(trigger).toHaveTextContent("Selecciona agente"));
    expect(screen.getByLabelText("Agente seleccionado")).toHaveTextContent("vacio");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
  });
});
