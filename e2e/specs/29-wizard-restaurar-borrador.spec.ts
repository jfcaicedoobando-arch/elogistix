/**
 * Flujo 29 — Restaurar borrador del wizard de cotización (R-09).
 *
 * Hallazgo Ronda 3: el banner "¿Retomar donde te quedaste?" aparecía pero
 * "Restaurar" devolvía Paso 1 vacío (el autosave pisaba el reset).
 *
 * Escenario: capturar Paso 1 → salir de la ruta → volver → Restaurar →
 * asertar que los datos capturados siguen ahí.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 29 — Wizard cotización: restaurar borrador", () => {
  test("restaura los datos capturados y el paso del wizard", async ({ page }) => {
    await loginAs(page, internalCreds());
    await page.goto("/cotizaciones/nueva");

    // Si hay un borrador previo, descartarlo para partir limpio.
    const descartar = page.getByRole("button", { name: /descartar/i }).first();
    if (await descartar.isVisible().catch(() => false)) await descartar.click();

    // Paso 1: seleccionar el primer cliente disponible.
    const clienteTrigger = page.getByRole("combobox").first();
    await expect(clienteTrigger).toBeVisible({ timeout: 20_000 });
    await clienteTrigger.click();
    const primeraOpcion = page.getByRole("option").first();
    await expect(primeraOpcion).toBeVisible({ timeout: 10_000 });
    const clienteTexto = (await primeraOpcion.textContent())?.trim() ?? "";
    await primeraOpcion.click();
    expect(clienteTexto.length).toBeGreaterThan(0);

    // Esperar al autosave (debounce) antes de abandonar la ruta.
    await page.waitForTimeout(2_500);

    // Salir y volver.
    await page.goto("/cotizaciones");
    await page.goto("/cotizaciones/nueva");

    const banner = page.getByText(/retomar donde te quedaste/i);
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /restaurar/i }).first().click();

    // El banner desaparece y el cliente capturado sigue presente (no vuelve vacío).
    await expect(banner).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(clienteTexto, { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
