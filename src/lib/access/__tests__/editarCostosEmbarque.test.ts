/**
 * B1 (v13.823.395): `EDITAR_COSTOS_EMBARQUE` es la capacidad estrecha para
 * capturar/editar costos y pricing del embarque. Debe ser falsa SÓLO para
 * coordinador logístico y gerente de operaciones, y conservar el resto de los
 * roles que ya tenían `canEdit` (`OPERATIONS`).
 */
import { describe, it, expect } from "vitest";
import { OPERATIONS, EDITAR_COSTOS_EMBARQUE, hasRole } from "../permissionMatrix";

const SOLO_LECTURA_COSTOS = ["coordinador_logistico", "gerente_operaciones"] as const;

describe("EDITAR_COSTOS_EMBARQUE", () => {
  it("excluye a los roles operativos de sólo lectura de costos", () => {
    SOLO_LECTURA_COSTOS.forEach(rol => {
      expect(hasRole(EDITAR_COSTOS_EMBARQUE, rol)).toBe(false);
    });
  });

  it("conserva a los demás roles operativos", () => {
    OPERATIONS.filter(r => !SOLO_LECTURA_COSTOS.includes(r as never)).forEach(rol => {
      expect(hasRole(EDITAR_COSTOS_EMBARQUE, rol)).toBe(true);
    });
  });

  it("no agrega roles fuera de OPERATIONS", () => {
    EDITAR_COSTOS_EMBARQUE.forEach(rol => {
      expect(OPERATIONS).toContain(rol);
    });
  });
});
