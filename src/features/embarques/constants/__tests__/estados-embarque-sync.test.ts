/**
 * Guardrail v13.302.10 — La constante UI `ESTADOS_EMBARQUE` debe respetar
 * el happy path de la máquina de estados de BD (mig. `20260718214722`).
 *
 * `getSiguienteEstado` calcula la próxima transición usando el orden de la
 * constante. Si la UI se desincroniza, "Avanzar estado" propone transiciones
 * inválidas y la BD rebota con `LC_TRANSICION_INVALIDA` (requestId c80465e4).
 */
import { describe, it, expect } from "vitest";
import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";

const HAPPY_PATH_BD = [
  "Borrador",
  "Cotización",
  "Confirmado",
  "En Tránsito",
  "En Aduana",
  "Llegada",
  "Arribo",
  "Entregado",
  "EIR",
  "Cerrado",
];

describe("ESTADOS_EMBARQUE (UI) ⇔ máquina de estados (BD)", () => {
  it("respeta el orden del happy path de la migración 20260718214722", () => {
    expect([...ESTADOS_EMBARQUE]).toEqual(HAPPY_PATH_BD);
  });

  it("no contiene 'Cancelado' (estado paralelo, no parte del avance)", () => {
    expect(ESTADOS_EMBARQUE).not.toContain("Cancelado");
  });
});
