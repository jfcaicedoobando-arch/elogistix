/**
 * B1 (v13.823.395): `EDITAR_COSTOS_EMBARQUE` es la capacidad estrecha para
 * capturar/editar costos y pricing del embarque.
 *
 * Decisión 2026-09-21: `coordinador_logistico` pasa a ESCRITURA de costos (el
 * paso 3 del wizard no le aparecía). Debe ser falsa SÓLO para
 * `gerente_operaciones`, y conservar el resto de los roles que ya tenían
 * `canEdit` (`OPERATIONS`).
 */
import { describe, it, expect } from "vitest";
import { OPERATIONS, EDITAR_COSTOS_EMBARQUE, hasRole } from "../permissionMatrix";

const SOLO_LECTURA_COSTOS = ["gerente_operaciones"] as const;

describe("EDITAR_COSTOS_EMBARQUE", () => {
  it("excluye a los roles operativos de sólo lectura de costos", () => {
    SOLO_LECTURA_COSTOS.forEach(rol => {
      expect(hasRole(EDITAR_COSTOS_EMBARQUE, rol)).toBe(false);
    });
  });

  it("incluye a coordinador_logistico (edita costos del embarque que opera)", () => {
    expect(hasRole(EDITAR_COSTOS_EMBARQUE, "coordinador_logistico")).toBe(true);
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
