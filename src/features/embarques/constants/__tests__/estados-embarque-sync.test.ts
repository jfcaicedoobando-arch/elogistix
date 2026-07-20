/**
 * Guardrail v13.302.10 / v13.303.21 — La constante UI `ESTADOS_EMBARQUE`
 * debe respetar el happy path de la máquina de estados de BD.
 *
 * `getSiguienteEstado` calcula la próxima transición usando el orden de la
 * constante. Si la UI se desincroniza, "Avanzar estado" propone transiciones
 * inválidas y la BD rebota con `LC_TRANSICION_INVALIDA`.
 *
 * v13.303.21: `Cotización` (Propuesta) fue eliminado del workflow. Borrador
 * salta directo a Confirmado.
 */
import { describe, it, expect } from "vitest";
import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";

const HAPPY_PATH_BD = [
  "Borrador",
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
  it("respeta el orden del happy path (Cotización eliminada en v13.303.21)", () => {
    expect([...ESTADOS_EMBARQUE]).toEqual(HAPPY_PATH_BD);
  });

  it("no contiene 'Cancelado' (estado paralelo, no parte del avance)", () => {
    expect(ESTADOS_EMBARQUE).not.toContain("Cancelado");
  });

  it("no contiene 'Cotización' (estado deprecado desde v13.303.21)", () => {
    expect(ESTADOS_EMBARQUE).not.toContain("Cotización");
  });
});
