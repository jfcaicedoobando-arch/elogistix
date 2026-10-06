import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import QuickAddMenu from "../QuickAddMenu";

vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canCrearLead: true, canCrearOportunidad: true, canCrearActividad: true, canGestionarLeadsEnLote: false }) }));
vi.mock("@/features/crm/components/objetos/NuevoObjetoCrmDialog", () => ({ NuevoObjetoCrmDialog: () => null }));
vi.mock("../quickCreate/QuickCreateLeadDialog", () => ({ default: () => null }));
vi.mock("../quickCreate/QuickCreateOportunidadDialog", () => ({ default: () => null }));
vi.mock("../NuevoLeadDialog", () => ({ default: () => null }));
vi.mock("../NuevaOportunidadDialog", () => ({ default: () => null }));
vi.mock("../ImportarLeadsCsvDialog", () => ({ default: () => null }));
vi.mock("../quickCreate/QuickCreateActividadDialog", () => ({ default: ({ open, onCreated, onMore }: { open: boolean; onCreated: () => void; onMore: (draft: object) => void }) => open ? <><button onClick={onCreated}>Guardar express mock</button><button onClick={() => onMore({ asunto: "Seguimiento Altamira" })}>Más campos mock</button></> : null }));
vi.mock("../NuevaActividadDialog", () => ({ default: ({ open, onCreated }: { open: boolean; onCreated: () => void }) => open ? <button onClick={onCreated}>Guardar completo mock</button> : null }));

function Location() {
  const l = useLocation();
  return <output>{l.pathname + l.search + l.hash}</output>;
}

describe("ambas altas usan el retorno que conserva la agenda", () => {
  it.each(["express", "completo"])("mantiene filtros después del formulario %s", async formulario => {
    const url = "/crm/actividades?q=resinas&tipo=llamada&responsable=mias&page=2#lista";
    render(<MemoryRouter initialEntries={[url]}><QuickAddMenu /><Location /></MemoryRouter>);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Nuevo" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Nueva actividad/ }));
    if (formulario === "completo") fireEvent.click(screen.getByRole("button", { name: "Más campos mock" }));
    fireEvent.click(screen.getByRole("button", { name: `Guardar ${formulario} mock` }));
    expect(screen.getByRole("status")).toHaveTextContent(url);
  });
});
