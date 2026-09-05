/**
 * P2 UI (13.823.142): el editor de plantillas distingue error de carga de
 * "Sin plantillas todavía" (consulta exitosa vacía).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { plantillasMock } = vi.hoisted(() => ({ plantillasMock: vi.fn() }));

vi.mock("@/features/crm/hooks", () => ({
  usePlantillasMensaje: () => plantillasMock(),
  useCrearPlantilla: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useActualizarPlantilla: () => ({ mutate: vi.fn(), isPending: false }),
  useEliminarPlantilla: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

import PlantillasMensajeEditor from "../PlantillasMensajeEditor";

const base = {
  data: [] as unknown[],
  isLoading: false,
  isError: false,
  error: null as unknown,
  refetch: vi.fn(),
  isFetching: false,
};

beforeEach(() => {
  plantillasMock.mockReset();
});

describe("PlantillasMensajeEditor — error vs vacío", () => {
  it("consulta fallida muestra error recuperable, no el empty", () => {
    plantillasMock.mockReturnValue({ ...base, isError: true, error: new Error("rls") });
    render(<PlantillasMensajeEditor />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/No pudimos cargar las plantillas/i)).toBeInTheDocument();
    expect(screen.queryByText("Sin plantillas todavía")).not.toBeInTheDocument();
  });

  it("consulta exitosa vacía conserva 'Sin plantillas todavía'", () => {
    plantillasMock.mockReturnValue({ ...base });
    render(<PlantillasMensajeEditor />);
    expect(screen.getByText("Sin plantillas todavía")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("con datos lista las plantillas", () => {
    plantillasMock.mockReturnValue({
      ...base,
      data: [{ id: "p1", nombre: "Bienvenida", canal: "email", asunto: "Hola", cuerpo: "Hola", activa: true }],
    });
    render(<PlantillasMensajeEditor />);
    expect(screen.getByDisplayValue("Bienvenida")).toBeInTheDocument();
    expect(screen.queryByText("Sin plantillas todavía")).not.toBeInTheDocument();
  });
});
