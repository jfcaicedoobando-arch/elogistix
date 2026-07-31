/**
 * Flujo 31 — Autosave del wizard de cotización no remonta el paso (R4 P1-4).
 *
 * Hallazgo Ronda 4: al pasar el debounce del autosave (800 ms) el paso se
 * remontaba y el campo perdía foco y contenido (4/4 reproducciones).
 *
 * Este spec escribe en un campo de texto del wizard, espera el debounce y
 * verifica que el foco y el valor sobrevivan. Se repite 4 veces (misma
 * cadencia del hallazgo original).
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 31 — Wizard cotización: autosave sin remontaje", () => {
  test("el campo conserva foco y valor tras el autosave (×4)", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/cotizaciones/nueva");

    // Partir de un wizard limpio si hay borrador previo.
    const descartar = page.getByRole("button", { name: /descartar/i }).first();
    if (await descartar.isVisible().catch(() => false)) await descartar.click();

    // Primer campo de texto libre del wizard (notas/observaciones o similar).
    const campo = page
      .locator("input[type='text']:not([readonly]), textarea:not([readonly])")
      .first();
    await expect(campo).toBeVisible({ timeout: 20_000 });

    for (let intento = 1; intento <= 4; intento += 1) {
      const valor = `R4 autosave ${intento}`;
      await campo.click();
      await campo.fill(valor);

      // Esperar el debounce del autosave (800 ms) con margen.
      await page.waitForTimeout(2_000);

      await expect(campo, `valor tras autosave (intento ${intento})`).toHaveValue(valor);
      const sigueEnfocado = await campo.evaluate((el) => el === document.activeElement);
      expect(sigueEnfocado, `foco tras autosave (intento ${intento})`).toBe(true);
    }
  });
});
