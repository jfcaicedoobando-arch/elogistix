/**
 * Regresión: las flechas de subir/bajar deben INTERCAMBIAR el orden con la
 * etapa vecina (RPC atómica), no sumar ±1 al orden propio — eso generaba
 * órdenes duplicados. Se valida además el bloqueo en el primer/último elemento
 * y el bloqueo mientras la mutación está en curso (doble clic).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const actualizarMutateAsync = vi.fn();
const reordenarMutateAsync = vi.fn();
let reordenarPending = false;

const ETAPAS = [
  { id: "e1", nombre: "Prospección", tipo: "abierta", color: "#111111", probabilidad_default: 10, orden: 1, activa: true, crea_tarea_seguimiento: false, dias_seguimiento: 3, sla_dias: 7 },
  { id: "e2", nombre: "Cotización", tipo: "abierta", color: "#222222", probabilidad_default: 40, orden: 2, activa: true, crea_tarea_seguimiento: false, dias_seguimiento: 3, sla_dias: 7 },
  { id: "e3", nombre: "Cierre", tipo: "ganada", color: "#333333", probabilidad_default: 100, orden: 3, activa: true, crea_tarea_seguimiento: false, dias_seguimiento: 3, sla_dias: 7 },
];

vi.mock("@/features/crm/hooks", () => ({
  useEtapasPipelineAll: () => ({ data: ETAPAS, isLoading: false }),
  useActualizarEtapa: () => ({ mutateAsync: actualizarMutateAsync, isPending: false }),
  useIntercambiarOrdenEtapas: () => ({ mutateAsync: reordenarMutateAsync, isPending: reordenarPending }),
}));

import EtapasPipelineEditor from "@/features/crm/components/EtapasPipelineEditor";

const botonesSubir = () => screen.getAllByRole("button", { name: "Subir" });
const botonesBajar = () => screen.getAllByRole("button", { name: "Bajar" });

describe("EtapasPipelineEditor · orden", () => {
  beforeEach(() => {
    actualizarMutateAsync.mockReset();
    reordenarMutateAsync.mockReset();
    reordenarPending = false;
  });

  it("subir intercambia con la etapa anterior", () => {
    render(<EtapasPipelineEditor />);
    fireEvent.click(botonesSubir()[1]);
    expect(reordenarMutateAsync).toHaveBeenCalledTimes(1);
    expect(reordenarMutateAsync).toHaveBeenCalledWith({ etapaA: "e2", etapaB: "e1" });
    expect(actualizarMutateAsync).not.toHaveBeenCalled();
  });

  it("bajar intercambia con la etapa siguiente", () => {
    render(<EtapasPipelineEditor />);
    fireEvent.click(botonesBajar()[1]);
    expect(reordenarMutateAsync).toHaveBeenCalledWith({ etapaA: "e2", etapaB: "e3" });
  });

  it("respeta límites: primera no sube y última no baja", () => {
    render(<EtapasPipelineEditor />);
    expect(botonesSubir()[0]).toBeDisabled();
    expect(botonesBajar()[2]).toBeDisabled();
    fireEvent.click(botonesSubir()[0]);
    fireEvent.click(botonesBajar()[2]);
    expect(reordenarMutateAsync).not.toHaveBeenCalled();
  });

  it("bloquea las flechas mientras el intercambio está en curso (doble clic)", () => {
    reordenarPending = true;
    render(<EtapasPipelineEditor />);
    expect(botonesBajar()[0]).toBeDisabled();
    fireEvent.click(botonesBajar()[0]);
    expect(reordenarMutateAsync).not.toHaveBeenCalled();
  });
});
