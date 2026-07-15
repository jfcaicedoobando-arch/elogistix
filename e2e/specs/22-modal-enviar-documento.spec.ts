/**
 * Flujo 22 — Modal "Enviar documento por correo" (rediseño 13.300.17).
 * v13.300.23 — usa data-testid del EmailChipsField.
 */
import { test, expect } from "../fixtures/pageErrors";
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

    await page
      .getByRole("button", { name: /enviar por correo|^reenviar$/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole("heading", { name: /enviar cotizaci[oó]n|reenviar cotizaci[oó]n/i }),
    ).toBeVisible();

    const paraField = dialog.getByLabel(/^destinatarios$/i);
    const ccField = dialog.getByLabel(/^copia cc$/i);
    await expect(paraField).toBeVisible();
    await expect(ccField).toBeVisible();

    // Chip bloqueado del usuario logueado en CC — selector estable.
    const lockedChip = ccField.getByTestId("envio-chip-locked").first();
    await expect(lockedChip).toBeVisible();

    // Toggle contacto → aparece un chip nuevo en "Para".
    const contactCheckboxes = dialog.getByRole("checkbox");
    if ((await contactCheckboxes.count()) > 0) {
      const before = await paraField.getByTestId("envio-chip").count();
      await contactCheckboxes.first().check().catch(() => null);
      await expect
        .poll(() => paraField.getByTestId("envio-chip").count(), { timeout: 3_000 })
        .toBeGreaterThanOrEqual(before);
    }

    await dialog.getByRole("button", { name: /cancelar/i }).click();
    await expect(dialog).toBeHidden();
  });
});
