/**
 * B1 (v13.823.395): `EDITAR_COSTOS_EMBARQUE` es la capacidad estrecha para
 * capturar/editar costos y pricing del embarque.
 *
 * Decisión 2026-09-21: `coordinador_logistico` pasa a ESCRITURA de costos.
 * Decisión 2026-10-06: `gerente_operaciones` también captura y edita costos.
 * Ahora coincide con todos los roles operativos (`OPERATIONS`).
 */
import { describe, it, expect } from "vitest";
import { OPERATIONS, EDITAR_COSTOS_EMBARQUE, hasRole } from "../permissionMatrix";

describe("EDITAR_COSTOS_EMBARQUE", () => {
  it("incluye a gerente_operaciones y coordinador_logistico", () => {
    expect(hasRole(EDITAR_COSTOS_EMBARQUE, "gerente_operaciones")).toBe(true);
    expect(hasRole(EDITAR_COSTOS_EMBARQUE, "coordinador_logistico")).toBe(true);
  });

  it("incluye a todos los roles operativos", () => {
    OPERATIONS.forEach(rol => {
      expect(hasRole(EDITAR_COSTOS_EMBARQUE, rol)).toBe(true);
    });
  });

  it("no agrega roles fuera de OPERATIONS", () => {
    EDITAR_COSTOS_EMBARQUE.forEach(rol => {
      expect(OPERATIONS).toContain(rol);
    });
  });

  it("excluye roles financieros y de solo consulta", () => {
    (["contador", "tesorero", "gerente_visor", "viewer"] as const).forEach(rol => {
      expect(hasRole(EDITAR_COSTOS_EMBARQUE, rol)).toBe(false);
    });
  });
});
