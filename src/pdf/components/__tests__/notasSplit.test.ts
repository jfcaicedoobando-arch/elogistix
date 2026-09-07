import { describe, it, expect } from "vitest";
import { splitNotas } from "../notasSplit";

describe("splitNotas (R188-PDF-01)", () => {
  it("mantiene notas cortas en un solo trozo", () => {
    const { head, rest } = splitNotas("Precios sujetos a cambio sin previo aviso.");
    expect(head).toBe("Precios sujetos a cambio sin previo aviso.");
    expect(rest).toBe("");
  });

  it("divide notas largas en un encabezado corto y un resto que puede fluir", () => {
    const texto = "Condiciones generales del servicio. ".repeat(30).trim();
    const { head, rest } = splitNotas(texto);
    expect(head.length).toBeLessThanOrEqual(180);
    expect(rest.length).toBeGreaterThan(0);
    expect(`${head} ${rest}`).toBe(texto);
  });

  it("corta en frontera de palabra, sin partir palabras", () => {
    const texto = `${"palabra ".repeat(40)}fin`;
    const { head } = splitNotas(texto);
    expect(head.endsWith("palabra")).toBe(true);
  });

  it("acota el encabezado a pocos renglones aunque las líneas sean cortas", () => {
    const texto = Array.from({ length: 100 }, () => "A").join("\n");
    const { head, rest } = splitNotas(texto);
    expect(head.split("\n").length).toBeLessThanOrEqual(3);
    expect(`${head}\n${rest}`).toBe(texto);
  });

  it("acota el encabezado con saltos CRLF", () => {
    const texto = Array.from({ length: 50 }, (_, i) => `Linea ${i}`).join("\r\n");
    const { head, rest } = splitNotas(texto);
    expect(head.split(/\r\n|\r|\n/).length).toBeLessThanOrEqual(3);
    expect(rest.startsWith("Linea 2")).toBe(true);
  });

  it("no parte un par surrogate", () => {
    const texto = `${"x".repeat(179)}😀${"y".repeat(200)}`;
    const { head, rest } = splitNotas(texto);
    expect(head.endsWith("\ud83d")).toBe(false);
    expect(rest.startsWith("\ude00")).toBe(false);
  });
});

