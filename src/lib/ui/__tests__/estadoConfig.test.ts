/**
 * Regression: los estados operativos migrados en el Lote 3B (v13.300.2) no
 * pueden volver a introducir literales Tailwind (cyan/violet/orange/indigo).
 * Todo el sistema visual de estado debe pasar por tokens semánticos
 * (`state-arribo`, `state-aduana`, `state-eir`, `state-operacion`).
 */
import { describe, it, expect } from "vitest";
import { ESTADO_CONFIG, getEstadoVisual } from "@/lib/ui/estadoConfig";

const LITERAL_TAILWIND =
  /(?:bg|text|border|from|to)-(?:cyan|violet|orange|indigo|purple|sky|blue)-\d{3}/;

describe("estadoConfig — tokens semánticos", () => {
  it("ningún estado usa literales Tailwind de color en badge/bar/border/text/gradient", () => {
    const offenders: string[] = [];
    for (const [estado, cfg] of Object.entries(ESTADO_CONFIG)) {
      const cls = [cfg.badge, cfg.bar, cfg.border, cfg.borderLeft, cfg.text, cfg.gradient].join(" ");
      if (LITERAL_TAILWIND.test(cls)) offenders.push(`${estado} → ${cls}`);
    }
    expect(offenders).toEqual([]);
  });

  it("Arribo, En Aduana, EIR y En operación usan tokens de la familia state-*", () => {
    expect(ESTADO_CONFIG.Arribo.text).toBe("text-state-arribo");
    expect(ESTADO_CONFIG["En Aduana"].text).toBe("text-state-aduana");
    expect(ESTADO_CONFIG.EIR.text).toBe("text-state-eir");
    expect(ESTADO_CONFIG["En operación"].badge).toContain("state-operacion");
  });

  it("getEstadoVisual devuelve fallback muted para estados desconocidos", () => {
    const v = getEstadoVisual("EstadoInexistente");
    expect(v.badge).toContain("bg-muted");
    expect(v.text).toBe("text-muted-foreground");
  });
});
