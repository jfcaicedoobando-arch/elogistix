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

test("height breakpoint and CSS variable sidebar widths retain their v3 behavior", async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 900 });
  const content = page.getByTestId("visual-page-container");
  await expect(content).toHaveCSS("max-width", "1536px");
  await page.setViewportSize({ width: 1280, height: 801 });
  await expect(content).toHaveCSS("padding-top", "24px");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(content).toHaveCSS("padding-top", "16px");
  // The fixed frame owns the width variable and its 1px border.
  const sidebar = page.locator('[data-sidebar="sidebar"]').locator("..");
  await expect(sidebar).toHaveCSS("width", "256px");
  await page.getByRole("button", { name: "Mostrar u ocultar la barra lateral", exact: true }).click();
  await expect(sidebar).toHaveCSS("width", "48px");
  const margins = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "space-y-2";
    probe.style.cssText = "position:absolute;visibility:hidden";
    probe.innerHTML = '<div class="mb-2">First</div><div hidden>Hidden</div><div>Last</div>';
    document.body.append(probe);
    const result = [getComputedStyle(probe.children[0]).marginBottom, getComputedStyle(probe.children[2]).marginTop];
    probe.remove();
    return result;
  });
  expect(margins).toEqual(["8px", "8px"]);
});
