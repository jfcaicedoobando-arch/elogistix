/**
 * Undo desde etapas cerradas (hallazgos P2-2 y P2-3): al deshacer un
 * movimiento que SALIÓ de "ganada" o "perdida" hay que reponer los datos de
 * cierre que la salida limpió; si la fotografía no existe, no se ofrece Undo.
 */
import { describe, it, expect } from "vitest";
import {
  resolverRestauracionCierre,
  puedeRestaurarCierre,
} from "../moverOportunidadEtapaHelpers";

const ganada = { id: "e-g", tipo: "ganada" } as never;
const perdida = { id: "e-p", tipo: "perdida" } as never;
const abierta = { id: "e-a", tipo: "abierta" } as never;

const opGanada = {
  id: "op-1",
  fecha_cierre_real: "2026-03-01",
  valor_real: 15000,
  motivo_perdida_id: null,
} as never;
const opPerdida = {
  id: "op-2",
  fecha_cierre_real: null,
  valor_real: null,
  motivo_perdida_id: "mot-1",
} as never;

describe("resolverRestauracionCierre", () => {
  it("regresar a ganada repone fecha y valor de cierre", () => {
    expect(resolverRestauracionCierre(ganada, opGanada)).toEqual({
      fecha_cierre_real: "2026-03-01",
      valor_real: 15000,
    });
  });

  it("regresar a perdida repone el motivo que la BD valida", () => {
    expect(resolverRestauracionCierre(perdida, opPerdida)).toEqual({
      motivo_perdida_id: "mot-1",
    });
  });

  it("etapas abiertas no tocan datos de cierre", () => {
    expect(resolverRestauracionCierre(abierta, opGanada)).toEqual({});
  });
});

describe("puedeRestaurarCierre", () => {
  it("permite el Undo cuando existe la fotografía", () => {
    expect(puedeRestaurarCierre(ganada, opGanada)).toBe(true);
    expect(puedeRestaurarCierre(perdida, opPerdida)).toBe(true);
  });

  it("no ofrece Undo si falta el dato obligatorio del cierre", () => {
    expect(puedeRestaurarCierre(ganada, opPerdida)).toBe(false);
    expect(puedeRestaurarCierre(perdida, opGanada)).toBe(false);
  });

  it("transiciones ordinarias siempre pueden deshacerse", () => {
    expect(puedeRestaurarCierre(abierta, opGanada)).toBe(true);
    expect(puedeRestaurarCierre(undefined, undefined)).toBe(true);
  });
});
