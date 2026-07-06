import { describe, it, expect } from "vitest";
import { SCORE_ESTADO_CONFIG, type ScoreEstado } from "../scoreEstadoConfig";

describe("SCORE_ESTADO_CONFIG", () => {
  const estados: ScoreEstado[] = ["excelente", "bueno", "regular", "malo"];

  it("contiene entrada para cada estado", () => {
    for (const e of estados) {
      expect(SCORE_ESTADO_CONFIG[e]).toBeDefined();
    }
  });

  it("cada entrada tiene label, text, accent y msg no vacíos", () => {
    for (const e of estados) {
      const cfg = SCORE_ESTADO_CONFIG[e];
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.text).toMatch(/^text-/);
      expect(cfg.accent).toMatch(/^bg-/);
      expect(cfg.msg.length).toBeGreaterThan(0);
    }
  });

  it("malo usa tono destructive", () => {
    expect(SCORE_ESTADO_CONFIG.malo.text).toBe("text-destructive");
    expect(SCORE_ESTADO_CONFIG.malo.accent).toBe("bg-destructive");
  });
});
