import { expect, test } from "@playwright/test";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 01 — Login interno", () => {
  test("usuario interno puede iniciar sesión y ver el dashboard", async ({ page }) => {
    await loginAs(page, internalCreds());

    // El shell autenticado siempre muestra el sidebar con la marca.
    await expect(page.getByText(/libre carga/i).first()).toBeVisible({ timeout: 15_000 });

    // No debe haber errores cruzados visibles.
    await expect(page.getByText(/credenciales inválidas|error/i)).toHaveCount(0);
  });

  test("credenciales inválidas muestran error", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/correo|email/i).fill("noexiste@librecarga.test");
    await page.getByLabel(/contrase/i).fill("incorrecto123");
    await page.getByRole("button", { name: /iniciar sesión|entrar|ingresar/i }).click();

    await expect(page.getByText(/inválid|incorrect|error/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
