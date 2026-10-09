import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { OportunidadQuickDraft } from "../quickCreate/QuickCreateOportunidadDialog";
import QuickAddMenu from "../QuickAddMenu";

vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({
    canCrearLead: false,
    canCrearOportunidad: true,
    canCrearActividad: false,
    canGestionarLeadsEnLote: false,
  }),
}));
vi.mock("../objetos/NuevoObjetoCrmDialog", () => ({ NuevoObjetoCrmDialog: () => null }));
vi.mock("../quickCreate/QuickCreateLeadDialog", () => ({ default: () => null }));
vi.mock("../quickCreate/QuickCreateActividadDialog", () => ({ default: () => null }));

// Los formularios se simulan para probar el transporte y ciclo del borrador
// en el menú real, sin consultas ni persistencia de oportunidades.
vi.mock("../quickCreate/QuickCreateOportunidadDialog", () => ({
  default: ({ open, onMore }: {
    open: boolean;
    onMore: (draft: OportunidadQuickDraft) => void;
  }) => open ? (
    <form aria-label="Alta rápida de oportunidad" onSubmit={(event) => {
      event.preventDefault();
      const values = new window.FormData(event.currentTarget);
      const empresaId = String(values.get("empresa") ?? "");
      onMore({
        nombre: String(values.get("nombre") ?? ""),
        empresa: empresaId ? { id: empresaId, nombre: "Acme" } : null,
        origen: empresaId ? {
          tipo: "prospecto", id: "lead-1", nombre: "Acme",
          vendedorId: "vendedor-1", vendedorEmail: "vendedor@example.test",
        } : null,
        etapaId: String(values.get("etapa") ?? "") || null,
        valorEstimado: String(values.get("valorEstimado") ?? ""),
      });
    }}>
      <label>Nombre<input name="nombre" /></label>
      <label>Empresa<select name="empresa" defaultValue="">
        <option value="">Sin empresa</option><option value="empresa-1">Acme</option>
      </select></label>
      <label>Etapa<select name="etapa" defaultValue="">
        <option value="">Sin etapa</option><option value="etapa-1">Prospecto</option>
      </select></label>
      <label>Valor estimado (MXN)<input name="valorEstimado" /></label>
      <button type="submit">Más campos</button>
    </form>
  ) : null,
}));

vi.mock("../quickCreate/QuickAddFullDialogs", () => ({
  default: ({ opOpen, opDraft, onOpOpenChange }: {
    opOpen: boolean;
    opDraft: OportunidadQuickDraft | null;
    onOpOpenChange: (open: boolean) => void;
  }) => <>
    <output aria-label="Borrador completo">{JSON.stringify(opDraft)}</output>
    {opOpen && (
      <section role="dialog" aria-label="Oportunidad completa">
        <label>Nombre completo<input readOnly value={opDraft?.nombre ?? ""} /></label>
        <label>Importe completo (MXN)<input readOnly value={opDraft?.valorEstimado ?? ""} /></label>
        <output aria-label="Empresa completa">{JSON.stringify(opDraft?.empresa ?? null)}</output>
        <output aria-label="Origen completo">{JSON.stringify(opDraft?.origen ?? null)}</output>
        <output aria-label="Etapa completa">{opDraft?.etapaId ?? ""}</output>
        <button onClick={() => onOpOpenChange(false)}>Cerrar completo</button>
        <button onClick={() => onOpOpenChange(false)}>Guardar completo</button>
      </section>
    )}
  </>,
}));

async function abrirDesdeMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Nuevo" }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole("menuitem", { name: /Nueva oportunidad/ }));
}

function llenarIdentidad() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Importación Acme" } });
  fireEvent.change(screen.getByLabelText("Empresa"), { target: { value: "empresa-1" } });
  fireEvent.change(screen.getByLabelText("Etapa"), { target: { value: "etapa-1" } });
}

function comprobarBorradorCompleto(valorEstimado: string) {
  expect(screen.getByRole("dialog", { name: "Oportunidad completa" })).toBeVisible();
  expect(screen.queryByRole("form", { name: "Alta rápida de oportunidad" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Nombre completo")).toHaveValue("Importación Acme");
  expect(screen.getByLabelText("Importe completo (MXN)")).toHaveValue(valorEstimado);
  expect(screen.getByLabelText("Empresa completa")).toHaveTextContent(JSON.stringify({ id: "empresa-1", nombre: "Acme" }));
  expect(screen.getByLabelText("Origen completo")).toHaveTextContent(JSON.stringify({
    tipo: "prospecto", id: "lead-1", nombre: "Acme",
    vendedorId: "vendedor-1", vendedorEmail: "vendedor@example.test",
  }));
  expect(screen.getByLabelText("Etapa completa")).toHaveTextContent("etapa-1");
}

function comprobarAltaRapidaVacia() {
  expect(screen.queryByRole("dialog", { name: "Oportunidad completa" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Borrador completo")).toHaveTextContent(/^null$/);
  expect(screen.getByRole("form", { name: "Alta rápida de oportunidad" })).toBeVisible();
  expect(screen.getByLabelText("Nombre")).toHaveValue("");
  expect(screen.getByLabelText("Empresa")).toHaveValue("");
  expect(screen.getByLabelText("Etapa")).toHaveValue("");
  expect(screen.getByLabelText("Valor estimado (MXN)")).toHaveValue("");
}

function MenuConAtajo() {
  const [n, setN] = useState(0);
  return <>
    <button onClick={() => setN((prev) => prev + 1)}>Abrir oportunidad con atajo</button>
    <QuickAddMenu dialogTrigger={{ kind: "oportunidad", n }} />
  </>;
}

describe("QuickAddMenu transporta el borrador de oportunidad y lo limpia al cerrar", () => {
  it.each(["1500", "", "0", "1500.25"])("transfiere importe %j y los demás campos a Más campos, y limpia al cancelar", async (valorEstimado) => {
    render(<MemoryRouter><QuickAddMenu /></MemoryRouter>);
    await abrirDesdeMenu();
    llenarIdentidad();
    fireEvent.change(screen.getByLabelText("Valor estimado (MXN)"), { target: { value: valorEstimado } });
    fireEvent.click(screen.getByRole("button", { name: "Más campos" }));
    comprobarBorradorCompleto(valorEstimado);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar completo" }));
    expect(screen.getByLabelText("Borrador completo")).toHaveTextContent(/^null$/);
    await abrirDesdeMenu();
    comprobarAltaRapidaVacia();
  });

  it.each(["1500", "0", "1500.25"])("transfiere un borrador con sólo el importe %j y lo limpia al cancelar", async (valorEstimado) => {
    render(<MemoryRouter><QuickAddMenu /></MemoryRouter>);
    await abrirDesdeMenu();
    fireEvent.change(screen.getByLabelText("Valor estimado (MXN)"), { target: { value: valorEstimado } });
    fireEvent.click(screen.getByRole("button", { name: "Más campos" }));
    expect(screen.getByRole("dialog", { name: "Oportunidad completa" })).toBeVisible();
    expect(screen.getByLabelText("Borrador completo")).toHaveTextContent(`"valorEstimado":"${valorEstimado}"`);
    expect(screen.getByLabelText("Importe completo (MXN)")).toHaveValue(valorEstimado);
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("");
    expect(screen.getByLabelText("Empresa completa")).toHaveTextContent("null");
    expect(screen.getByLabelText("Origen completo")).toHaveTextContent("null");
    expect(screen.getByLabelText("Etapa completa")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar completo" }));
    expect(screen.getByLabelText("Borrador completo")).toHaveTextContent(/^null$/);
    await abrirDesdeMenu();
    comprobarAltaRapidaVacia();
  });

  it.each([
    ["Cerrar completo", "menú"],
    ["Cerrar completo", "atajo"],
    ["Guardar completo", "menú"],
    ["Guardar completo", "atajo"],
  ])("%s elimina el borrador y la siguiente apertura por %s muestra el alta rápida vacía", async (cierre, apertura) => {
    render(<MemoryRouter><MenuConAtajo /></MemoryRouter>);
    await abrirDesdeMenu();
    llenarIdentidad();
    fireEvent.change(screen.getByLabelText("Valor estimado (MXN)"), { target: { value: "1500.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Más campos" }));
    comprobarBorradorCompleto("1500.25");

    fireEvent.click(screen.getByRole("button", { name: cierre }));
    expect(screen.getByLabelText("Borrador completo")).toHaveTextContent(/^null$/);
    if (apertura === "menú") await abrirDesdeMenu();
    else fireEvent.click(screen.getByRole("button", { name: "Abrir oportunidad con atajo" }));
    comprobarAltaRapidaVacia();
  });
});
