import { describe, it, expect } from "vitest";
import { usdTarifa, formatFechaMx } from "../tarifaFormatters";

describe("costeo/utils/tarifaFormatters", () => {
  describe("usdTarifa", () => {
    it("formatea números positivos como USD en estilo mexicano", () => {
      // Intl puede usar NBSP o espacios; validamos partes clave.
      const out = usdTarifa(1234.5);
      expect(out).toContain("1,234.50");
      expect(out).toContain("USD");
    });

    it("trata null, undefined y NaN como 0", () => {
      expect(usdTarifa(null)).toContain("0.00");
      expect(usdTarifa(undefined)).toContain("0.00");
      expect(usdTarifa(Number("abc"))).toContain("0.00");
    });

    it("respeta negativos", () => {
      const out = usdTarifa(-50);
      expect(out).toMatch(/-|\(/); // signo o paréntesis según locale
      expect(out).toContain("50.00");
    });
  });

  describe("formatFechaMx", () => {
    it("convierte YYYY-MM-DD a DD/MM/YYYY", () => {
      expect(formatFechaMx("2026-06-20")).toBe("20/06/2026");
    });

    it("ignora la parte de hora (ISO completo)", () => {
      expect(formatFechaMx("2026-12-31T23:59:00Z")).toBe("31/12/2026");
    });

    it("retorna em-dash para null/undefined/cadena vacía", () => {
      expect(formatFechaMx(null)).toBe("—");
      expect(formatFechaMx(undefined)).toBe("—");
      expect(formatFechaMx("")).toBe("—");
    });

    it("devuelve la entrada original si no parsea YYYY-MM-DD", () => {
      expect(formatFechaMx("no-es-fecha")).toBe("no-es-fecha");
    });
  });
});
