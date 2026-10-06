import { expect, test, type Page } from "@playwright/test";

const custom = "/?desde=2026-10-15&hasta=2026-10-20&modo=Terrestre&sort=costo_usd&dir=desc";
const applied = "2026-10-15|2026-10-20|Terrestre|costo_usd|desc";
const blockedRequests = new WeakMap<Page, string[]>();
test.beforeEach(async ({ context, page }) => {
  const blocked: string[] = [];
  blockedRequests.set(page, blocked);
  await context.route("**/*", route => {
    const request = route.request();
    const url = new URL(request.url());
    const staticPath = url.pathname === "/" || url.pathname.startsWith("/assets/");
    if (url.origin === "http://127.0.0.1:8097" && request.method() === "GET" && staticPath) return route.continue();
    blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
    return route.abort("blockedbyclient");
  });
  await context.routeWebSocket(/.*/, socket => { blocked.push("WebSocket attempt"); socket.close(); });
  await page.clock.setFixedTime(new Date("2026-10-06T12:00:00-06:00"));
});
test.afterEach(async ({ page }) => {
  expect(blockedRequests.get(page), "No external or mutation requests from the isolated fixture").toEqual([]);
});
async function editFuture(page: Page) {
  await page.getByRole("button", { name: /Filtros de fecha y modo/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filtros de reporte" });
  await sheet.getByRole("button", { name: "15 oct 2026", exact: true }).click();
  await page.getByRole("button", { name: /mes siguiente|next month/i }).click();
  await page.locator('[data-day="2026-11-10"] button').click();
  await page.keyboard.press("Escape");
  // Radix keeps the closing popover layer mounted for its exit animation.
  // Wait for its real dismissal/focus handoff before testing the next layer.
  await expect(page.locator("[data-day]")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "10 nov 2026", exact: true })).toBeFocused();
  await expect(sheet.getByRole("button", { name: "10 nov 2026", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "30 nov 2026", exact: true })).toBeVisible();
  return sheet;
}
for (const viewport of [{ width: 390, height: 720 }, { width: 584, height: 378 }]) {
  for (const dismissal of ["Cerrar", "Escape"]) {
    test(`136 discard via ${dismissal} at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      await page.goto(custom);
      const url = page.url();
      const sheet = await editFuture(page);
      await expect(page.getByTestId("applied")).toHaveText(applied);
      if (dismissal === "Cerrar") await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
      else await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(page.getByTestId("applied")).toHaveText(applied);
      await expect(page.getByTestId("dataset")).toHaveText("Filas sintéticas: 0");
      await expect(page).toHaveURL(url);
      await page.screenshot({ path: info.outputPath("cancel-preserves-range.png"), fullPage: true });
    });
  }
}
test("136 apply commits both limits and clear then close does not overwrite them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto(custom);
  const sheet = await editFuture(page);
  await sheet.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.getByTestId("applied")).toHaveText("2026-11-10|2026-11-30|Terrestre|costo_usd|desc");
  const url = page.url();
  await page.getByRole("button", { name: /Filtros de fecha y modo/ }).click();
  await sheet.getByRole("button", { name: "Limpiar", exact: true }).click();
  await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByTestId("applied")).toHaveText("2026-11-10|2026-11-30|Terrestre|costo_usd|desc");
});
test("136 inverse date crossing is discarded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto(custom);
  await page.getByRole("button", { name: /Filtros de fecha y modo/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filtros de reporte" });
  await sheet.getByRole("button", { name: "20 oct 2026", exact: true }).click();
  await page.getByRole("button", { name: /mes anterior|previous month/i }).click();
  await page.locator('[data-day="2026-09-05"] button').click();
  await page.keyboard.press("Escape");
  await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByTestId("applied")).toHaveText(applied);
});
for (const width of [390, 1180]) {
  test(`137 real row or card retains dates, mode and sorting through browser history at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 757 });
    await page.goto("/?desde=2026-10-01&hasta=2026-10-31&modo=all&sort=costo_usd&dir=desc");
    if (width < 768) await page.getByRole("button", { name: /Filtros de fecha y modo/ }).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Terrestre", exact: true }).click();
    if (width < 768) await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(page.getByTestId("applied")).toHaveText("2026-10-01|2026-10-31|Terrestre|costo_usd|desc");
    const url = page.url();
    await expect(page.getByTestId("dataset")).toHaveText("Filas sintéticas: 1");
    if (width < 768) {
      for (const label of ["Venta eq. USD", "Utilidad eq. USD"]) {
        const text = page.getByText(label, { exact: true });
        await expect(text).toBeVisible();
        expect(await text.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
    }
    await page.getByText("Cliente Sintético", { exact: true }).click();
    await expect(page).toHaveURL(/\/clientes\/synthetic$/);
    await page.goBack();
    await expect(page).toHaveURL(url);
    await expect(page.getByTestId("applied")).toHaveText("2026-10-01|2026-10-31|Terrestre|costo_usd|desc");
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Cliente sintético acumulado MXN" })).toBeVisible();
    await page.goBack();
    await page.reload();
    await expect(page).toHaveURL(url);
    await expect(page.getByTestId("applied")).toHaveText("2026-10-01|2026-10-31|Terrestre|costo_usd|desc");
    await page.screenshot({ path: info.outputPath("back-preserves-filters.png"), fullPage: true });
  });
}
