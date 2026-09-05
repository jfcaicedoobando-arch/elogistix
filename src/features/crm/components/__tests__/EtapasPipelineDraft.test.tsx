/**
 * v13.823.104 — Regresión: un refetch (por ejemplo tras guardar otra fila) no
 * debe borrar los cambios sin guardar de una fila distinta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const actualizarMutateAsync = vi.fn();
const reordenarMutateAsync = vi.fn();

const base = {
  tipo: "abierta", color: "#111111", probabilidad_default: 10, activa: true,
  crea_tarea_seguimiento: false, dias_seguimiento: 3, sla_dias: 7,
};

let etapas = [
  { ...base, id: "e1", nombre: "Prospección", orden: 1 },
  { ...base, id: "e2", nombre: "Cotización", orden: 2 },
];

vi.mock("@/features/crm/hooks", () => ({
  useEtapasPipelineAll: () => ({ data: etapas, isLoading: false }),
  useActualizarEtapa: () => ({ mutateAsync: actualizarMutateAsync, isPending: false }),
  useIntercambiarOrdenEtapas: () => ({ mutateAsync: reordenarMutateAsync, isPending: false }),
}));

import EtapasPipelineEditor from "@/features/crm/components/EtapasPipelineEditor";

describe("EtapasPipelineEditor · borradores", () => {
  beforeEach(() => {
    actualizarMutateAsync.mockReset();
    etapas = [
      { ...base, id: "e1", nombre: "Prospección", orden: 1 },
      { ...base, id: "e2", nombre: "Cotización", orden: 2 },
    ];
  });

  it("conserva el borrador de A cuando un refetch confirma el cambio de B", () => {
    const { rerender } = render(<EtapasPipelineEditor />);

    // Edito A sin guardar.
    const inputA = screen.getByLabelText("Nombre de la etapa Prospección");
    fireEvent.change(inputA, { target: { value: "Prospección AAA" } });
    expect(screen.getByLabelText("Nombre de la etapa Prospección AAA")).toBeInTheDocument();

    // B se guarda y el refetch trae la nueva lista.
    etapas = [
      { ...base, id: "e1", nombre: "Prospección", orden: 1 },
      { ...base, id: "e2", nombre: "Cotización FINAL", orden: 2 },
    ];
    rerender(<EtapasPipelineEditor />);

    // A conserva su edición y B adopta el valor confirmado.
    expect(screen.getByLabelText("Nombre de la etapa Prospección AAA")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de la etapa Cotización FINAL")).toBeInTheDocument();
  });

  it("rehidrata filas limpias y descarta filas eliminadas", () => {
    const { rerender } = render(<EtapasPipelineEditor />);

    etapas = [{ ...base, id: "e1", nombre: "Prospección v2", orden: 1 }];
    rerender(<EtapasPipelineEditor />);

    expect(screen.getByLabelText("Nombre de la etapa Prospección v2")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre de la etapa Cotización")).not.toBeInTheDocument();
  });
});
