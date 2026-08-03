/** R-07 — Los toasts nunca deben mostrar HTML crudo ni textos kilométricos. */
import { describe, it, expect } from "vitest";
import { sanitizeToastText, pareceHtml } from "@/lib/ui/sanitizeToastText";

describe("sanitizeToastText (R-07)", () => {
  it("deja pasar mensajes normales sin tocarlos", () => {
    expect(sanitizeToastText("No se pudo guardar la factura")).toBe("No se pudo guardar la factura");
  });

  it("convierte nulos y vacíos en undefined", () => {
    expect(sanitizeToastText(undefined)).toBeUndefined();
    expect(sanitizeToastText(null)).toBeUndefined();
    expect(sanitizeToastText("   ")).toBeUndefined();
  });

  it("reemplaza una página HTML completa por un mensaje entendible", () => {
    const html = "<!DOCTYPE html><html><head><title>502</title></head><body><h1>Bad gateway</h1></body></html>";
    const out = sanitizeToastText(html);
    expect(out).toBeDefined();
    expect(out).not.toContain("<");
  });

  it("quita etiquetas de fragmentos con marcado", () => {
    expect(sanitizeToastText("<p>Error de validación del RFC</p>")).toBe("Error de validación del RFC");
  });

  it("recorta textos muy largos", () => {
    const out = sanitizeToastText("a".repeat(500));
    expect(out).toBeDefined();
    expect(out!.length).toBeLessThanOrEqual(240);
    expect(out!.endsWith("…")).toBe(true);
  });

  it("pareceHtml detecta documentos y no mensajes con < aislado", () => {
    expect(pareceHtml("<html><body>x</body></html>")).toBe(true);
    expect(pareceHtml("El monto debe ser < 1000")).toBe(false);
  });
});

describe("sanitizeToastText — FIX 6 (P3)", () => {
  it("no muestra nombres crudos de constraints", () => {
    const out = sanitizeToastText(
      'duplicate key value violates unique constraint "proveedor_facturas_org_prov_folio_uq"',
    );
    expect(out).toBeDefined();
    expect(out).not.toContain("proveedor_facturas_org_prov_folio_uq");
  });

  it("normaliza el doble punto de 'p. m..'", () => {
    expect(sanitizeToastText("Aceptaste la cotización el 03/08/2026, 1:05 p. m..")).toBe(
      "Aceptaste la cotización el 03/08/2026, 1:05 p. m.",
    );
  });
});
