import { describe, expect, it } from "vitest";
import { layoutStyles } from "../stylesLayout";

/**
 * R184-PDF-01: el pie se anclaba con `bottom` sin altura y el motor lo dibujaba
 * fuera de la hoja; con altura explícita se perdía la paginación dinámica.
 * Contrato: anclaje por `top` porcentual, sin `bottom` ni `height`, y columnas
 * con ancho explícito (dentro de un contenedor absoluto el ancho auto colapsa).
 */
describe("pdf/theme footer (R184-PDF-01)", () => {
  const footer = layoutStyles.footer as Record<string, unknown>;

  it("se ancla con top porcentual y no usa bottom ni height", () => {
    expect(footer.position).toBe("absolute");
    expect(typeof footer.top).toBe("string");
    expect(String(footer.top)).toMatch(/^9[0-9](\.\d+)?%$/);
    expect(footer.bottom).toBeUndefined();
    expect(footer.height).toBeUndefined();
  });

  it("queda dentro del área reservada por el padding inferior de la página", () => {
    const alturaLetter = 792;
    const topPt = (parseFloat(String(footer.top)) / 100) * alturaLetter;
    const finContenido = alturaLetter - layoutStyles.page.paddingBottom;
    expect(topPt).toBeGreaterThan(finContenido);
    expect(topPt).toBeLessThan(alturaLetter - 20);
  });

  it("las tres columnas tienen ancho explícito y suman <= 100%", () => {
    const anchos = [
      layoutStyles.footerColLeft.width,
      layoutStyles.footerColCenter.width,
      layoutStyles.footerColRight.width,
    ];
    for (const w of anchos) expect(String(w)).toMatch(/%$/);
    const suma = anchos.reduce((acc, w) => acc + parseFloat(String(w)), 0);
    expect(suma).toBeLessThanOrEqual(100);
    expect(suma).toBeGreaterThanOrEqual(95);
  });
});
