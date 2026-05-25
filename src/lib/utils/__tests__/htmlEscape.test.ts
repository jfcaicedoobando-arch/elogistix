import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/utils/htmlEscape";

describe("escapeHtml", () => {
  it("retorna string vacío para null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
  it("escapa & primero para evitar doble-escape", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
  it("escapa < y >", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });
  it("escapa comillas dobles y simples", () => {
    expect(escapeHtml(`O"Hara's`)).toBe("O&quot;Hara&#39;s");
  });
  it("previene inyección XSS completa", () => {
    const xss = `<img src=x onerror="alert('xss')">`;
    const out = escapeHtml(xss);
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain('"');
    expect(out).not.toContain("'");
  });
  it("convierte números a string", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});
