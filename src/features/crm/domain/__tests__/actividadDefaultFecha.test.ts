import { describe, it, expect } from "vitest";
import { withFrozenClock } from "@/test/helpers/withFrozenClock";
import { actividadDefaultFechaMx } from "../actividadDefaultFecha";

describe("actividadDefaultFechaMx", () => {
  describe("antes de las 17:00 CDMX en día hábil", () => {
    // 2026-06-15 es lunes; 14:00 UTC = 08:00 CDMX (UTC-6).
    withFrozenClock("2026-06-15T14:00:00Z");
    it("usa hoy 17:00", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-15T17:00");
    });
  });

  describe("a las 17:00 o después CDMX", () => {
    // 23:30 UTC = 17:30 CDMX el mismo lunes.
    withFrozenClock("2026-06-15T23:30:00Z");
    it("empuja al siguiente día hábil 9:00 (no nace vencida)", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-16T09:00");
    });
  });

  describe("viernes después de las 17:00", () => {
    // 2026-06-19 es viernes; 23:30 UTC = 17:30 CDMX.
    withFrozenClock("2026-06-19T23:30:00Z");
    it("salta el fin de semana al siguiente lunes 9:00", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-22T09:00");
    });
  });

  describe("sábado", () => {
    // 2026-06-20 es sábado; 14:00 UTC = 08:00 CDMX.
    withFrozenClock("2026-06-20T14:00:00Z");
    it("aunque sea temprano, salta al lunes 9:00 (no es día hábil)", () => {
      expect(actividadDefaultFechaMx()).toBe("2026-06-22T09:00");
    });
  });
});
