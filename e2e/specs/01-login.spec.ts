import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

test.describe("Flujo 01 — Login interno", () => {
  test("usuario interno puede iniciar sesión y ver el dashboard", async ({ page }) => {
    await loginAs(page, internalCreds());

    // El shell autenticado siempre muestra el sidebar con la marca.
    await expect(page.getByText(/libre carga/i).first()).toBeVisible({ timeout: 15_000 });

    // No debe haber errores cruzados visibles (filtrar a regiones de alerta
    // para no matchear copy ambiental con la palabra "error").
    await expect(page.getByRole("alert").filter({ hasText: /credenciales|error/i })).toHaveCount(0);
  });

  test.describe("formulario sin sesión", () => {
    // Forzar contexto limpio: ignorar el storageState del project para
    // ver el formulario de login y validar el error con credenciales malas.
    test.use({ storageState: { cookies: [], origins: [] } });

    test("credenciales inválidas muestran error", async ({ page }) => {
      await page.goto("/");
      await page.getByLabel(/correo|email/i).fill("noexiste@librecarga.test");
      await page.getByLabel(/contrase/i).fill("incorrecto123");
      await page.getByRole("button", { name: /iniciar sesión|entrar|ingresar/i }).click();

      // Buscar el error específicamente en una región de alerta (toast/sonner
      // o role=alert), no en cualquier texto de la página.
      const alerta = page
        .locator('[role="alert"], [data-sonner-toast]')
        .filter({ hasText: /inválid|incorrect|error/i })
        .first();
      await expect(alerta).toBeVisible({ timeout: 15_000 });
    });
  });
});
