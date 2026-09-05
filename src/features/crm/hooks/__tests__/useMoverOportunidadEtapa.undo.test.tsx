/**
 * Undo falso al mover a "perdida": mover a una etapa tipo `perdida` cancela
 * actividades pendientes (efecto lateral irreversible), por lo que el hook NO
 * debe ofrecer Undo. En transiciones ordinarias el Undo se conserva.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const showUndoToast = vi.hoisted(() => vi.fn());
const mutateAsync = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock("@/features/crm/hooks/useUndoToast", () => ({ showUndoToast }));
vi.mock("@/features/crm/hooks", () => ({
  useMoverEtapaConAutomatizacion: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));
vi.mock("../moverOportunidadEtapaHelpers", () => ({
  resolverProbabilidad: () => 50,
  resolverCierreGanada: () => ({}),
  resolverLimpiezaCierre: () => ({}),
  avisarCriteriosPendientes: vi.fn(async () => undefined),
  // v13.823.121: el hook consulta si el destino creará una tarea automática.
  destinoGeneraTareaAutomatica: (e?: { tipo?: string; crea_tarea_seguimiento?: boolean | null }) =>
    e?.tipo === "ganada" || (e?.tipo === "abierta" && e?.crea_tarea_seguimiento === true),
}));

import { useMoverOportunidadEtapa } from "../useMoverOportunidadEtapa";

const etapas = [
  { id: "e-abierta", nombre: "Cotizando", tipo: "abierta" },
  { id: "e-perdida", nombre: "Perdida", tipo: "perdida" },
  { id: "e-ganada", nombre: "Ganada", tipo: "ganada" },
  { id: "e-seguim", nombre: "Propuesta", tipo: "abierta", crea_tarea_seguimiento: true },
] as never[];
const oportunidades = [
  { id: "op-1", nombre: "Op 1", etapa_id: "e-abierta", probabilidad: 30 },
] as never[];

beforeEach(() => {
  showUndoToast.mockClear();
  mutateAsync.mockClear();
});

describe("useMoverOportunidadEtapa — Undo y etapa perdida", () => {
  it("destino perdida: confirma motivo, mueve una sola vez y NO ofrece Undo", async () => {
    const { result } = renderHook(() => useMoverOportunidadEtapa({ etapas, oportunidades }));

    await act(async () => {
      await result.current.handleMover("op-1", "e-perdida", 0);
    });
    // Primero pide motivo, sin mover todavía.
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(result.current.perdidaPendiente?.id).toBe("op-1");

    await act(async () => {
      await result.current.confirmarPerdida("motivo-1");
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(showUndoToast).not.toHaveBeenCalled();
  });

  it("transición ordinaria: sí ofrece Undo", async () => {
    const { result } = renderHook(() => useMoverOportunidadEtapa({ etapas, oportunidades }));
    await act(async () => {
      await result.current.handleMover("op-1", "e-abierta", 50);
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(showUndoToast).toHaveBeenCalledTimes(1);
  });

  // v13.823.121 — Undo no puede borrar la tarea automática que crea el destino.
  it("destino ganada: no ofrece Undo (crea 'Generar cotización en firme')", async () => {
    const { result } = renderHook(() => useMoverOportunidadEtapa({ etapas, oportunidades }));
    await act(async () => {
      await result.current.handleMover("op-1", "e-ganada", 100);
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(showUndoToast).not.toHaveBeenCalled();
  });

  it("destino abierta con crea_tarea_seguimiento: no ofrece Undo", async () => {
    const { result } = renderHook(() => useMoverOportunidadEtapa({ etapas, oportunidades }));
    await act(async () => {
      await result.current.handleMover("op-1", "e-seguim", 60);
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(showUndoToast).not.toHaveBeenCalled();
  });
});
