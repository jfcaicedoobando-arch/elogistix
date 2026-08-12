/**
 * v13.550.0 — captura de fecha con teclado: la máscara debe respetar los
 * separadores tecleados. Antes `1/3/2026` se convertía en `13/20/26`.
 */
import { describe, it, expect } from "vitest";
import { applyMaskTyping, parseDisplay } from "@/components/ui/date-picker-mx-helpers";

describe("applyMaskTyping", () => {
  it("completa día y mes con cero al cerrar con separador", () => {
    expect(applyMaskTyping("1/3/2026")).toBe("01/03/2026");
    expect(applyMaskTyping("1-3-2026")).toBe("01/03/2026");
    expect(applyMaskTyping("1.3.2026")).toBe("01/03/2026");
  });

  it("no adivina mientras el segmento sigue abierto", () => {
    expect(applyMaskTyping("1")).toBe("1");
    expect(applyMaskTyping("1/")).toBe("01/");
    expect(applyMaskTyping("01/1")).toBe("01/1");
    expect(applyMaskTyping("01/12")).toBe("01/12");
    expect(applyMaskTyping("01/12/")).toBe("01/12/");
  });

  it("sigue soportando la captura corrida de 8 dígitos", () => {
    expect(applyMaskTyping("01032026")).toBe("01/03/2026");
    expect(applyMaskTyping("0103")).toBe("01/03");
  });

  it("ignora caracteres no válidos y recorta a 10", () => {
    expect(applyMaskTyping("1a/3b/2026")).toBe("01/03/2026");
    expect(applyMaskTyping("01/03/20261234")).toBe("01/03/2026");
  });

  it("el resultado alimenta parseDisplay para fechas válidas", () => {
    expect(parseDisplay(applyMaskTyping("1/3/2026"))).toBe("2026-03-01");
    expect(parseDisplay(applyMaskTyping("31/2/2026"))).toBeNull();
  });
});
