import { expect, test } from "@playwright/test";
import { loginAs, portalCreds } from "../fixtures/auth";

test.describe("Flujo 05 — Portal cliente", () => {
  test("cliente puede iniciar sesión y ver su portal", async ({ page }) => {
    await loginAs(page, portalCreds());

    // El portal cliente vive bajo /portal/*. La redirección post-login lo lleva ahí.
    await expect(page).toHaveURL(/\/portal/i, { timeout: 20_000 });

    // El dashboard del portal debe mostrar un heading propio (no basta con
    // matchear cualquier texto del sidebar para evitar falsos verdes si el
    // contenido principal explotó).
    const heading = page
      .getByRole("heading", { name: /portal|mis (embarques|cargas|facturas)|bienvenid/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // No debe haber error boundary visible.
    await expect(page.getByText(/algo salió mal/i)).toHaveCount(0);
  });
});
