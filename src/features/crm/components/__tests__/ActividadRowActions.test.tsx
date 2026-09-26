import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { CrmActividadRow } from "@/features/crm/services/actividades";
import ActividadRowActions from "../ActividadRowActions";

const mocks = vi.hoisted(() => ({ completar: vi.fn(), posponer: vi.fn(), pending: false }));
vi.mock("@/features/crm/hooks", () => ({
  useCompletarActividad: () => ({ mutateAsync: mocks.completar, isPending: mocks.pending }),
  usePosponerActividad: () => ({ mutateAsync: mocks.posponer, isPending: false }),
}));
vi.mock("@/features/crm/components/actividades/ActividadNotasSheet", () => ({
  default: ({ open }: { open: boolean }) => open ? <div role="dialog">Notas de actividad</div> : null,
}));

const actividad: CrmActividadRow = {
  id: "a1", asunto: "Seguimiento flete Shanghai–Manzanillo", tipo: "llamada",
  descripcion: "", resultado: "", entidad_tipo: "lead", entidad_id: "lead1",
  fecha_programada: "2026-09-25T15:00:00Z", fecha_completada: null,
  responsable_email: "comercial@example.com", responsable_id: null,
  organization_id: "org1", created_at: "2026-09-24T00:00:00Z", updated_at: "2026-09-24T00:00:00Z",
  created_by: null, deleted_at: null, deleted_by: null, duracion_min: null,
  contacto_efectivo: false, reunion_calificada: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = false;
  mocks.completar.mockResolvedValue(undefined);
  mocks.posponer.mockResolvedValue(undefined);
});

describe("ActividadRowActions — menú compacto", () => {
  it("completa con el mismo payload sin abrir la fila", async () => {
    const rowClick = vi.fn();
    render(<div onClick={rowClick}><ActividadRowActions actividad={actividad} /></div>);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Acciones de actividad" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Marcar como completada" }));
    expect(mocks.completar).toHaveBeenCalledWith({ id: "a1" });
    expect(rowClick).not.toHaveBeenCalled();
  });

  it("mantiene posponer con teclado y la fecha original", async () => {
    render(<ActividadRowActions actividad={actividad} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Acciones de actividad" }), { button: 0, ctrlKey: false });
    const posponer = await screen.findByRole("menuitem", { name: "Posponer" });
    act(() => posponer.focus());
    fireEvent.keyDown(posponer, { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "+3 días" }));
    expect(mocks.posponer).toHaveBeenCalledWith({ id: "a1", dias: 3, fechaProgramada: actividad.fecha_programada });
  });

  it("ofrece notas, pero no completar ni posponer, en una actividad completada", async () => {
    render(<ActividadRowActions actividad={{ ...actividad, fecha_completada: "2026-09-25T17:00:00Z" }} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Acciones de actividad" }), { button: 0, ctrlKey: false });
    await screen.findByRole("menuitem", { name: "Notas / resultado" });
    expect(screen.queryByRole("menuitem", { name: "Marcar como completada" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Posponer" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Notas / resultado" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.completar).not.toHaveBeenCalled();
  });

  it("bloquea el menú durante la mutación", () => {
    mocks.pending = true;
    render(<ActividadRowActions actividad={actividad} />);
    expect(screen.getByRole("button", { name: "Acciones de actividad" })).toBeDisabled();
  });
});
