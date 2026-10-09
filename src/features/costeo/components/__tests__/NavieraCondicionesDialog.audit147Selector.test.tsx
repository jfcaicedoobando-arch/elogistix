import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { FilaNaviera } from "../../types/filaNaviera";
import type { ProveedorOpcion } from "../../services/agentes";
import { NavieraCondicionesDialog } from "../NavieraCondicionesDialog";

const state = vi.hoisted(() => ({
  organizationId: "org-a",
  proveedores: [] as ProveedorOpcion[],
  guardar: vi.fn(), reemplazar: vi.fn(),
}));
const tipos = [{ id: "40hc", code: "40HC", name: "40 pies High Cube" }];
const tramos = [{ id: "tramo-a", naviera_condicion_id: "cond-anl", tipo_contenedor_id: "40hc",
  desde_dia: 1, hasta_dia: null, monto_por_dia: 100, moneda: "USD" }];
vi.mock("@/features/costeo/hooks/useNavieraCondiciones", () => ({
  useProveedoresNaviera: () => ({ data: state.proveedores }),
  useCondicionNavieraMutations: () => ({ guardar: { mutateAsync: state.guardar, isPending: false } }),
  useTiposContenedorDemoras: () => ({ data: tipos }),
  useDemorasTramos: () => ({ data: tramos }),
  useReemplazarTramos: () => ({ mutateAsync: state.reemplazar, isPending: false }),
}));
vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organizationId: state.organizationId }),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ role: "gerente_operaciones", effectiveRole: "gerente_operaciones" }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));

const proveedor = { id: "proveedor-anl", nombre: "QA-ASUS147-20261009", pais: "MX" };
const alternativo = { id: "proveedor-alt", nombre: "Naviera alternativa", pais: "MX" };
const fila = (id = "anl", org = "org-a"): FilaNaviera => ({
  naviera_id: id, naviera_nombre: id.toUpperCase(), naviera_code: id.toUpperCase(),
  condicion: {
    id: `cond-${id}`, organization_id: org, naviera_id: id, proveedor_id: proveedor.id,
    tiene_carta_garantia: false, carta_garantia_vigente_hasta: null,
    carta_garantia_folio: null, carta_garantia_notas: null,
    dias_libres_demoras_default: 7, moneda_demoras: "USD", notas: `Guardada ${id}`,
    created_at: "2026-10-09", updated_at: "2026-10-09",
  },
});
const onOpenChange = vi.fn();
const onSaved = vi.fn();
const dialog = (seleccion: FilaNaviera | null) => (
  <MemoryRouter><NavieraCondicionesDialog seleccion={seleccion} onOpenChange={onOpenChange} onSaved={onSaved} /></MemoryRouter>
);
function tab(name: "Condiciones" | "Tabulador de demoras") {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
}
const notas = () => screen.getByLabelText("Notas generales");
const proveedorControl = () => screen.getByLabelText("Proveedor vinculado *");
const guardar = () => screen.getByRole("button", { name: "Actualizar condiciones" });
function sinEscrituras() {
  expect(state.guardar).not.toHaveBeenCalled();
  expect(state.reemplazar).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.clearAllMocks(); state.organizationId = "org-a";
  state.proveedores = [proveedor, alternativo];
  state.guardar.mockResolvedValue(undefined); state.reemplazar.mockResolvedValue(undefined);
});

describe("audit147 · selector y borrador de condiciones de naviera", () => {
  it("abre con opciones calientes sin borrar el proveedor persistido", () => {
    render(dialog(fila()));
    expect(proveedorControl()).toHaveTextContent(proveedor.nombre);
    expect(guardar()).toBeEnabled();
    sinEscrituras();
  });
  it("con opciones frías conserva proveedor y notas al volver del tabulador 40HC", async () => {
    state.proveedores = [];
    const seleccion = fila(); const view = render(dialog(seleccion));
    state.proveedores = [proveedor, alternativo]; view.rerender(dialog(seleccion));
    expect(proveedorControl()).toHaveTextContent(proveedor.nombre);
    fireEvent.change(notas(), { target: { value: "Nota sin guardar" } });
    for (let i = 0; i < 3; i++) {
      tab("Tabulador de demoras");
      expect(await screen.findByRole("combobox", { name: "Tipo de contenedor del tabulador" })).toHaveTextContent("40HC");
      tab("Condiciones");
      expect(proveedorControl()).toHaveTextContent(proveedor.nombre);
      expect(notas()).toHaveValue("Nota sin guardar");
      expect(guardar()).toBeEnabled();
    }
    sinEscrituras();
  });
  it("retiene el proveedor cambiado y demás captura sin guardar; sólo guarda al enviar", async () => {
    render(dialog(fila()));
    fireEvent.keyDown(proveedorControl(), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: alternativo.nombre }));
    fireEvent.change(notas(), { target: { value: "Nueva nota" } });
    fireEvent.change(screen.getByLabelText("Días libres de demoras (estándar)"), { target: { value: "11" } });
    tab("Tabulador de demoras"); tab("Condiciones");
    expect(proveedorControl()).toHaveTextContent(alternativo.nombre);
    expect(notas()).toHaveValue("Nueva nota");
    expect(screen.getByLabelText("Días libres de demoras (estándar)")).toHaveValue(11);
    sinEscrituras(); fireEvent.click(guardar());
    await waitFor(() => expect(state.guardar).toHaveBeenCalledWith({
      id: "cond-anl", input: expect.objectContaining({ naviera_id: "anl", proveedor_id: alternativo.id, notas: "Nueva nota", dias_libres_demoras_default: 11 }),
    }));
    expect(onSaved).toHaveBeenCalledOnce();
  });
  it("conserva también los tramos editados al cambiar de pestaña", async () => {
    render(dialog(fila())); tab("Tabulador de demoras");
    const desde = await screen.findByLabelText("Desde día del tramo 1");
    fireEvent.change(desde, { target: { value: "3" } });
    tab("Condiciones"); tab("Tabulador de demoras");
    expect(screen.getByLabelText("Desde día del tramo 1")).toHaveValue(3);
    sinEscrituras();
  });
  it("otra naviera empieza en Condiciones con su propio estado, no el borrador anterior", () => {
    const view = render(dialog(fila()));
    fireEvent.change(notas(), { target: { value: "No transferir" } }); tab("Tabulador de demoras");
    view.rerender(dialog(fila("msc")));
    expect(screen.getByRole("tab", { name: "Condiciones" })).toHaveAttribute("aria-selected", "true");
    expect(notas()).toHaveValue("Guardada msc"); expect(proveedorControl()).toHaveTextContent(proveedor.nombre);
    sinEscrituras();
  });
  it("una condición distinta de la misma naviera empieza con sus valores persistidos", () => {
    const view = render(dialog(fila()));
    fireEvent.change(notas(), { target: { value: "Condición anterior" } });
    const nueva = fila(); nueva.condicion!.id = "cond-anl-nueva";
    nueva.condicion!.notas = "Nueva condición"; view.rerender(dialog(nueva));
    expect(notas()).toHaveValue("Nueva condición"); sinEscrituras();
  });
  it("mantiene la captura montada pero oculta la pestaña inactiva del árbol accesible", () => {
    // CSS que genera Tailwind 3 para data-[state=inactive]:hidden. Se incluye
    // aquí porque jsdom no carga la hoja de utilidades de la aplicación.
    const style = document.createElement("style");
    style.textContent = String.raw`.data-\[state\=inactive\]\:hidden[data-state="inactive"] { display: none; }`;
    document.head.appendChild(style);
    try {
      render(dialog(fila()));
      const control = notas();
      const condiciones = control.closest('[role="tabpanel"]')!;
      expect(condiciones).toHaveClass("data-[state=inactive]:hidden");
      expect(condiciones).toBeVisible();
      tab("Tabulador de demoras");
      expect(control).toBeInTheDocument(); expect(condiciones).not.toBeVisible();
      expect(screen.queryByRole("textbox", { name: "Notas generales" })).toBeNull();
      expect(screen.getByRole("combobox", { name: "Tipo de contenedor del tabulador" })).toBeVisible();
      tab("Condiciones"); expect(control).toBeVisible();
      expect(screen.queryByRole("combobox", { name: "Tipo de contenedor del tabulador" })).toBeNull();
      sinEscrituras();
    } finally { style.remove(); }
  });
  it("cerrar y reabrir descarta la captura no guardada, sin persistirla", () => {
    const seleccion = fila(); const view = render(dialog(seleccion));
    fireEvent.change(notas(), { target: { value: "Borrador descartado" } });
    view.rerender(dialog(null)); view.rerender(dialog(seleccion));
    expect(notas()).toHaveValue("Guardada anl"); expect(proveedorControl()).toHaveTextContent(proveedor.nombre);
    sinEscrituras();
  });
  it("un cambio de organización oculta la condición ajena y no reutiliza su borrador", () => {
    const seleccion = fila(); const view = render(dialog(seleccion));
    fireEvent.change(notas(), { target: { value: "Sólo org A" } });
    state.organizationId = "org-b"; view.rerender(dialog(seleccion));
    expect(screen.queryByRole("dialog")).toBeNull();
    const nueva = fila("anl", "org-b"); nueva.condicion!.notas = "Propia org B";
    view.rerender(dialog(nueva));
    expect(notas()).toHaveValue("Propia org B"); sinEscrituras();
  });
  it("la llegada de una nueva referencia del mismo registro no borra captura local", () => {
    const view = render(dialog(fila()));
    fireEvent.change(notas(), { target: { value: "Borrador local" } });
    view.rerender(dialog(fila())); expect(notas()).toHaveValue("Borrador local"); sinEscrituras();
  });
  it("un evento nativo vacío no borra el vínculo ni la captura local", () => {
    render(dialog(fila()));
    fireEvent.change(notas(), { target: { value: "Conservar nota" } });
    const nativo = proveedorControl().closest("form")!.querySelector("select")!;
    fireEvent.change(nativo, { target: { value: "" } });
    expect(proveedorControl()).toHaveTextContent(proveedor.nombre);
    expect(notas()).toHaveValue("Conservar nota"); expect(guardar()).toBeEnabled(); sinEscrituras();
  });
  it("una condición nueva tampoco traslada su borrador al cambiar de organización", async () => {
    const seleccion = fila("nueva"); seleccion.condicion = null;
    const view = render(dialog(seleccion));
    fireEvent.keyDown(proveedorControl(), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: alternativo.nombre }));
    fireEvent.change(notas(), { target: { value: "Sólo org A" } });
    state.organizationId = "org-b"; view.rerender(dialog(seleccion));
    expect(proveedorControl()).toHaveTextContent("Selecciona proveedor");
    expect(notas()).toHaveValue("");
    expect(screen.getByRole("button", { name: "Crear condiciones" })).toBeDisabled(); sinEscrituras();
  });
  it("una naviera nueva sigue sin proveedor y no permite guardar implícitamente", () => {
    const seleccion = fila("nueva"); seleccion.condicion = null;
    render(dialog(seleccion));
    expect(proveedorControl()).toHaveTextContent("Selecciona proveedor");
    expect(screen.getByRole("button", { name: "Crear condiciones" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Tabulador de demoras" })).toBeDisabled(); sinEscrituras();
  });
});
