import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/utils/htmlEscape";

describe("htmlEscape | escapeHtml extra", () => {
  it("01 — retorna string vacío para null", () => {
    expect(escapeHtml(null as unknown as string)).toBe("");
  });
  it("02 — retorna string vacío para undefined", () => {
    expect(escapeHtml(undefined as unknown as string)).toBe("");
  });
  it("03 — escapa el ampersand &", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });
  it("04 — escapa <", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });
  it("05 — escapa >", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });
  it("06 — escapa comillas dobles", () => {
    expect(escapeHtml('"hola"')).toBe("&quot;hola&quot;");
  });
  it("07 — escapa comillas simples", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });
  it("08 — escapa script tag completo", () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;",
    );
  });
  it("09 — retorna el mismo valor cuando no hay caracteres especiales", () => {
    expect(escapeHtml("Hola mundo")).toBe("Hola mundo");
  });
  it("10 — convierte número a string", () => {
    expect(escapeHtml(42 as unknown as string)).toBe("42");
  });
  it("11 — convierte booleano a string", () => {
    expect(escapeHtml(true as unknown as string)).toBe("true");
  });
  it("12 — maneja string vacío", () => {
    expect(escapeHtml("")).toBe("");
  });
  it("13 — escapa múltiples ampersands", () => {
    expect(escapeHtml("&&")).toBe("&amp;&amp;");
  });
  it("14 — escapa atributo HTML completo", () => {
    expect(escapeHtml('<a href="page">link</a>')).toBe(
      "&lt;a href=&quot;page&quot;&gt;link&lt;/a&gt;",
    );
  });
});
