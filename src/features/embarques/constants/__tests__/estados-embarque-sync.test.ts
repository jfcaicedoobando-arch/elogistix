/**
 * Guardrail v13.303.22 — La constante UI `ESTADOS_EMBARQUE` debe respetar el
 * happy path de la máquina de estados de BD.
 *
 * `getSiguienteEstado` calcula la próxima transición usando el orden de la
 * constante. Si la UI se desincroniza, "Avanzar estado" propone transiciones
 * inválidas y la BD rebota con `LC_TRANSICION_INVALIDA`.
 *
 * v13.380.0: `Por liquidar` entra entre EIR y Cerrado (cierre administrativo).
 * v13.303.22: Arribo ahora va antes de En Aduana; `Llegada` sale del workflow.
 * v13.303.21: `Cotización` (Propuesta) eliminado.
 */
import { describe, it, expect } from "vitest";
import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";

const HAPPY_PATH_BD = [
  "Borrador",
  "Confirmado",
  "En Tránsito",
  "Arribo",
  "En Aduana",
  "Entregado",
  "EIR",
  "Por liquidar",
  "Cerrado",
];

describe("ESTADOS_EMBARQUE (UI) ⇔ máquina de estados (BD)", () => {
  it("respeta el orden del happy path v13.303.22 (Arribo → En Aduana, sin Llegada)", () => {
    expect([...ESTADOS_EMBARQUE]).toEqual(HAPPY_PATH_BD);
  });

  it("no contiene 'Cancelado' (estado paralelo, no parte del avance)", () => {
    expect(ESTADOS_EMBARQUE).not.toContain("Cancelado");
  });

  it("no contiene 'Cotización' (estado deprecado desde v13.303.21)", () => {
    expect(ESTADOS_EMBARQUE).not.toContain("Cotización");
  });

  it("no contiene 'Llegada' (estado deprecado desde v13.303.22)", () => {
    expect(ESTADOS_EMBARQUE).not.toContain("Llegada");
  });
});
