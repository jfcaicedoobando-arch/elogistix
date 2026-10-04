import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // This suite must not accidentally authenticate, send telemetry or contact Supabase.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") return route.continue();
    return route.abort("blockedbyclient");
  });
  await page.goto("/e2e/visual/index.html");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { name: "Cotizaciones", exact: true })).toBeVisible();
});

test("shared shell and table", async ({ page }) => {
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("$1,800.00", { exact: true })).toHaveCount(3);
  await expect(page).toHaveScreenshot("shell-table.png");
});
test("shared form dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Nueva cotización", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Cliente", { exact: true })).toHaveValue("Refacciones Industriales Regiomontanas");
  await expect(page).toHaveScreenshot("form-dialog.png");
});
test("empty, error and loading remain distinct", async ({ page }) => {
  await page.goto("/e2e/visual/index.html?state=empty");
  await expect(page.getByText("Sin cotizaciones", { exact: true })).toBeVisible();
  await page.goto("/e2e/visual/index.html?state=error");
  await expect(page.getByRole("button", { name: /reintentar/i })).toBeVisible();
  await expect(page.getByText("Sin cotizaciones", { exact: true })).toHaveCount(0);
  await page.goto("/e2e/visual/index.html?state=loading");
  await expect(page.getByRole("status")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status")).toContainText("Cargando…");
  await expect(page.getByText("Sin cotizaciones", { exact: true })).toHaveCount(0);
});
