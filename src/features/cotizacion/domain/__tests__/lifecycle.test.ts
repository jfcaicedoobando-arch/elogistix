import { describe, it, expect } from "vitest";
import { estaInactiva, puedeReactivar, ESTADOS_INACTIVOS } from "../lifecycle";

describe("cotizacion/domain/lifecycle", () => {
  describe("estaInactiva", () => {
    it("retorna true para 'Vencida' y 'Archivada'", () => {
      expect(estaInactiva("Vencida")).toBe(true);
      expect(estaInactiva("Archivada")).toBe(true);
    });

    it("retorna false para estados activos", () => {
      expect(estaInactiva("Enviada")).toBe(false);
      expect(estaInactiva("Aprobada")).toBe(false);
      expect(estaInactiva("Borrador")).toBe(false);
    });

    it("retorna false para null/undefined/string vacío", () => {
      expect(estaInactiva(null)).toBe(false);
      expect(estaInactiva(undefined)).toBe(false);
      expect(estaInactiva("")).toBe(false);
    });

    it("ESTADOS_INACTIVOS contiene exactamente los dos estados esperados", () => {
      expect([...ESTADOS_INACTIVOS]).toEqual(["Vencida", "Archivada"]);
    });
  });

  describe("puedeReactivar", () => {
    it("solo permite reactivar desde estados inactivos", () => {
      expect(puedeReactivar("Vencida")).toBe(true);
      expect(puedeReactivar("Archivada")).toBe(true);
      expect(puedeReactivar("Aprobada")).toBe(false);
      expect(puedeReactivar(null)).toBe(false);
    });
  });
});
