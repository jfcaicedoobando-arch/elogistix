/**
 * Regresión de accesibilidad: el botón de guardar de cada fila del editor de
 * etapas debe tener un aria-label descriptivo con el nombre de la etapa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const actualizarMutateAsync = vi.fn();
const reordenarMutateAsync = vi.fn();

const base = {
  tipo: "abierta" as const,
  color: "#111111",
  probabilidad_default: 10,
  activa: true,
  crea_tarea_seguimiento: false,
  dias_seguimiento: 3,
  sla_dias: 7,
};

const ETAPAS = [
  { ...base, id: "e1", nombre: "Prospección", orden: 1 },
  { ...base, id: "e2", nombre: "Cotización", orden: 2 },
];

vi.mock("@/features/crm/hooks", () => ({
  useEtapasPipelineAll: () => ({ data: ETAPAS, isLoading: false }),
  useActualizarEtapa: () => ({ mutateAsync: actualizarMutateAsync, isPending: false }),
  useIntercambiarOrdenEtapas: () => ({ mutateAsync: reordenarMutateAsync, isPending: false }),
}));

import EtapasPipelineEditor from "@/features/crm/components/EtapasPipelineEditor";

describe("EtapasPipelineEditor · accesibilidad", () => {
  beforeEach(() => {
    actualizarMutateAsync.mockReset();
  });

  it("el botón de guardar incluye el nombre de la etapa en su aria-label", () => {
    render(<EtapasPipelineEditor />);

    const input = screen.getByLabelText("Nombre de la etapa Prospección");
    fireEvent.change(input, { target: { value: "Prospección AAA" } });

    const guardar = screen.getByRole("button", { name: "Guardar cambios de Prospección AAA" });
    expect(guardar).toBeInTheDocument();
  });

  it("el botón de guardar sigue deshabilitado mientras la fila no tenga cambios", () => {
    render(<EtapasPipelineEditor />);

    const guardar = screen.getByRole("button", { name: "Guardar cambios de Prospección" });
    expect(guardar).toBeDisabled();
  });
});
