/**
 * v13.823.50 — regresión: las etapas terminales fuerzan la probabilidad
 * (ganada = 100, perdida = 0) aunque hubiera un valor manual previo.
 */
import { describe, it, expect } from "vitest";
import { resolverProbabilidad } from "../moverOportunidadEtapaHelpers";
import type { CrmEtapaRow, CrmOportunidadRow } from "@/features/crm/hooks";

const etapa = (over: Record<string, unknown>) => over as unknown as CrmEtapaRow & { tipo?: string };
const op = (probabilidad: number) => ({ probabilidad }) as unknown as CrmOportunidadRow;

describe("resolverProbabilidad", () => {
  const origen = etapa({ id: "e1", probabilidad_default: 30, tipo: "abierta" });

  it("fuerza 100 al mover a ganada aunque la probabilidad fuera manual", () => {
    const destino = etapa({ id: "e9", probabilidad_default: 90, tipo: "ganada" });
    expect(resolverProbabilidad(op(70), origen, 90, destino)).toBe(100);
  });

  it("fuerza 0 al mover a perdida aunque la probabilidad fuera manual", () => {
    const destino = etapa({ id: "e8", probabilidad_default: 0, tipo: "perdida" });
    expect(resolverProbabilidad(op(70), origen, 10, destino)).toBe(0);
  });

  it("conserva la probabilidad manual en etapas abiertas", () => {
    const destino = etapa({ id: "e2", probabilidad_default: 50, tipo: "abierta" });
    expect(resolverProbabilidad(op(70), origen, 50, destino)).toBe(70);
  });

  it("usa el default del destino cuando no había edición manual", () => {
    const destino = etapa({ id: "e2", probabilidad_default: 50, tipo: "abierta" });
    expect(resolverProbabilidad(op(30), origen, 50, destino)).toBe(50);
  });
});

describe("puedeOfrecerUndo (v13.823.121)", () => {
  const etapa = (over: Record<string, unknown>) => over as never;
  it("no ofrece Undo en etapa perdida", () => {
    expect(puedeOfrecerUndo(etapa({ tipo: "perdida" }))).toBe(false);
  });
  it("no ofrece Undo en etapa ganada (crea tarea automática)", () => {
    expect(puedeOfrecerUndo(etapa({ tipo: "ganada" }))).toBe(false);
  });
  it("no ofrece Undo en etapa abierta con crea_tarea_seguimiento", () => {
    expect(puedeOfrecerUndo(etapa({ tipo: "abierta", crea_tarea_seguimiento: true }))).toBe(false);
  });
  it("sí ofrece Undo en etapa abierta sin tarea automática", () => {
    expect(puedeOfrecerUndo(etapa({ tipo: "abierta", crea_tarea_seguimiento: false }))).toBe(true);
  });
});
