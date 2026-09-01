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
}));

import { useMoverOportunidadEtapa } from "../useMoverOportunidadEtapa";

const etapas = [
  { id: "e-abierta", nombre: "Cotizando", tipo: "abierta" },
  { id: "e-perdida", nombre: "Perdida", tipo: "perdida" },
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
});
