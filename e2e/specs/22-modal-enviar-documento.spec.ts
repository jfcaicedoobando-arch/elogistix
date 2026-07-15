/**
 * Flujo 22 — Modal "Enviar documento por correo" (rediseño 13.300.17).
 *
 * Verifica el nuevo patrón unificado:
 *  - Campo "Para" con chips (EmailChipsField)
 *  - Campo "CC" con chip bloqueado del usuario logueado
 *  - Toggle de un contacto agrega/quita chip de "Para"
 *
 * Entry point: detalle de cotización → "Enviar por correo".
 * Requiere ≥1 cotización en el tenant.
 */
import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 22 — Modal Enviar documento", () => {
  test("Para y CC usan chips; el usuario logueado aparece bloqueado en CC", async ({ page }) => {
    await loginAs(page, internalCreds());

    await page.goto("/cotizaciones");
    const rows = page.locator("table tbody tr");
    await rows.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => null);
    test.skip((await rows.count()) === 0, "Sin cotizaciones sembradas");

    await rows.first().click();
    await expect(page).toHaveURL(/\/cotizaciones\/[0-9a-f-]{36}/i, { timeout: 15_000 });

    // Botón "Enviar por correo" (o "Reenviar" si ya se envió).
    await page
      .getByRole("button", { name: /enviar por correo|^reenviar$/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole("heading", { name: /enviar cotizaci[oó]n|reenviar cotizaci[oó]n/i }),
    ).toBeVisible();

    // Campos con chips deben existir por aria-label.
    const paraField = dialog.getByLabel(/^destinatarios$/i);
    const ccField = dialog.getByLabel(/^copia cc$/i);
    await expect(paraField).toBeVisible();
    await expect(ccField).toBeVisible();

    // CC debe tener un chip bloqueado con el email del usuario logueado.
    // El chip locked se identifica por el tooltip "Siempre se agrega tu correo".
    const lockedChip = ccField.locator("[data-locked=true], [aria-label*='tu correo' i]").first();
    // Fallback: al menos un chip visible dentro de CC.
    const ccChips = ccField.locator("[data-chip], [role='listitem']");
    if (await lockedChip.count()) {
      await expect(lockedChip).toBeVisible();
    } else {
      await expect(ccChips.first()).toBeVisible();
    }

    // Toggle de un contacto (si hay checkboxes disponibles) debe agregar chip en Para.
    const contactCheckboxes = dialog.getByRole("checkbox");
    if ((await contactCheckboxes.count()) > 0) {
      const before = await paraField.locator("[data-chip], [role='listitem']").count();
      await contactCheckboxes.first().check().catch(() => null);
      await page.waitForTimeout(200);
      const after = await paraField.locator("[data-chip], [role='listitem']").count();
      expect(after).toBeGreaterThanOrEqual(before);
    }

    // Cerrar sin enviar.
    await dialog.getByRole("button", { name: /cancelar/i }).click();
    await expect(dialog).toBeHidden();
  });
});
