import { describe, it, expect } from "vitest";
import { decodeHtmlEntities } from "../decodeHtmlEntities";

describe("decodeHtmlEntities", () => {
  it("decodifica entidades nombradas comunes", () => {
    expect(decodeHtmlEntities("AL&amp;0807074L5")).toBe("AL&0807074L5");
    expect(decodeHtmlEntities("a &lt;b&gt; c")).toBe("a <b> c");
    expect(decodeHtmlEntities("&quot;hola&quot;")).toBe('"hola"');
  });

  it("es case-insensitive para nombres", () => {
    expect(decodeHtmlEntities("AL&AMP;123")).toBe("AL&123");
  });

  it("decodifica entidades numéricas decimales y hex", () => {
    expect(decodeHtmlEntities("&#38;")).toBe("&");
    expect(decodeHtmlEntities("&#x26;")).toBe("&");
  });

  it("maneja null/undefined y strings sin entidades", () => {
    expect(decodeHtmlEntities(null)).toBe("");
    expect(decodeHtmlEntities(undefined)).toBe("");
    expect(decodeHtmlEntities("SIN ENTIDAD")).toBe("SIN ENTIDAD");
  });

  it("deja intactas entidades desconocidas", () => {
    expect(decodeHtmlEntities("&foo;")).toBe("&foo;");
  });
});
