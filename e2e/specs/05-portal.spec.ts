import { expect, test } from "@playwright/test";
import { loginAs, portalCreds } from "../fixtures/auth";

test.describe("Flujo 05 — Portal cliente", () => {
  test("cliente puede iniciar sesión y ver su portal", async ({ page }) => {
    await loginAs(page, portalCreds());

    // El portal cliente vive bajo /portal/*. La redirección post-login lo lleva ahí.
    await expect(page).toHaveURL(/\/portal/i, { timeout: 20_000 });

    // Debe verse algún resumen (KPIs / cargas activas).
    await expect(
      page.getByText(/embarques|cargas|facturas|cotizaciones/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
