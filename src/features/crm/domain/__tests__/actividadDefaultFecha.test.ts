import { describe, it, expect } from "vitest";
import { withFrozenClock } from "@/test/helpers/withFrozenClock";
import { actividadDefaultFechaMx } from "../actividadDefaultFecha";

describe("actividadDefaultFechaMx", () => {
  describe("día hábil por la mañana", () => {
    // 2026-06-15 es lunes; 14:00 UTC = 08:00 CDMX (UTC-6).
    withFrozenClock("2026-06-15T14:00:00Z");
    it("programa mañana 9:00, no hoy 17:00", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-16T09:00");
    });
  });

  describe("día hábil por la tarde (13:18 CDMX, caso reproducido)", () => {
    // 19:18 UTC = 13:18 CDMX del mismo lunes.
    withFrozenClock("2026-06-15T19:18:00Z");
    it("también programa mañana 9:00", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-16T09:00");
    });
  });

  describe("después de las 17:00 CDMX", () => {
    // 23:30 UTC = 17:30 CDMX el mismo lunes.
    withFrozenClock("2026-06-15T23:30:00Z");
    it("sigue siendo mañana 9:00 (no nace vencida)", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-16T09:00");
    });
  });

  describe("viernes", () => {
    // 2026-06-19 es viernes; 14:00 UTC = 08:00 CDMX.
    withFrozenClock("2026-06-19T14:00:00Z");
    it("salta el fin de semana al lunes 9:00", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-22T09:00");
    });
  });

  describe("viernes después de las 17:00", () => {
    withFrozenClock("2026-06-19T23:30:00Z");
    it("también cae en lunes 9:00", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-22T09:00");
    });
  });

  describe("sábado", () => {
    // 2026-06-20 es sábado; 14:00 UTC = 08:00 CDMX.
    withFrozenClock("2026-06-20T14:00:00Z");
    it("programa el lunes 9:00", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-22T09:00");
    });
  });

  describe("domingo", () => {
    // 2026-06-21 es domingo; 14:00 UTC = 08:00 CDMX.
    withFrozenClock("2026-06-21T14:00:00Z");
    it("programa el lunes 9:00", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-22T09:00");
    });
  });
});
