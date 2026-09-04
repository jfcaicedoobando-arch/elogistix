import { describe, it, expect } from "vitest";
import { sanitizePdfText } from "../sanitizePdfText";

describe("sanitizePdfText", () => {
  it("convierte flechas en separadores legibles", () => {
    expect(sanitizePdfText("Tianjin → Manzanillo")).toBe("Tianjin - Manzanillo");
    expect(sanitizePdfText("⇒ destino")).toBe("- destino");
  });

  it("convierte la flecha de continuación en viñeta", () => {
    expect(sanitizePdfText("↳ Auto-cargado")).toBe("\u00B7 Auto-cargado");
  });

  it("normaliza comillas tipográficas y conserva acentos", () => {
    expect(sanitizePdfText("“Cotización” de Perú’s")).toBe('"Cotización" de Perú\'s');
  });

  it("deja intacto el texto sin caracteres problemáticos", () => {
    expect(sanitizePdfText("Flete Marítimo · 40' High Cube")).toBe("Flete Marítimo · 40' High Cube");
  });
});
