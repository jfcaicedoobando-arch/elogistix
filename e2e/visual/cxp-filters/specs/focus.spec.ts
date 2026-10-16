import { expect, test, type Page } from "@playwright/test";

const mobile = { width: 390, height: 844 };
const desktop = { width: 1280, height: 900 };
const custom = "/?q=folio&estatus=Vigente&moneda=USD&origen=Extranjero&aprobacion=aprobada&proveedorId=synthetic-p&categoriaPresupuestoId=synthetic-c&from=2026-01-01&to=2026-12-31&page=3";
const blocked = new WeakMap<Page, string[]>();
test.beforeEach(async ({ context, page }) => {
  const requests: string[] = [];
  page.on("pageerror", error => requests.push(`Page error: ${error.message}`));
  blocked.set(page, requests);
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:8103" && request.method() === "GET" &&
      (url.pathname === "/" || url.pathname.startsWith("/assets/"))) return route.continue();
    requests.push(`${request.method()} ${url.origin}${url.pathname}`);
    return route.abort("blockedbyclient");
  });
  await context.routeWebSocket(/.*/, socket => { requests.push("WebSocket attempt"); socket.close(); });
});
test.afterEach(async ({ page }) => { expect(blocked.get(page)).toEqual([]); });

const trigger = (page: Page) => page.getByRole("button", { name: /^Filtros/ });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Filtros de CxP" });
async function editStatus(page: Page, name: string) {
  const status = sheet(page).getByRole("combobox").first();
  await status.click();
  await page.getByRole("option", { name, exact: true }).click();
  // Finish the Select's exit/focus handoff before Escape targets the Sheet.
  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  await expect(status).toBeFocused();
}
async function dismiss(page: Page, method: string) {
  if (method === "Escape") await page.keyboard.press("Escape");
  else await sheet(page).getByRole("button", { name: method, exact: true }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
}

for (const viewport of [mobile, desktop]) {
  test(`${viewport.width}px restores focus on X without edits twice`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(custom);
    const url = page.url(), applied = await page.getByTestId("applied").textContent();
    for (let cycle = 0; cycle < 2; cycle++) {
      await trigger(page).click();
      await expect(sheet(page)).toBeVisible();
      await dismiss(page, "Cerrar");
      await expect(page).toHaveURL(url);
      await expect(page.getByTestId("applied")).toHaveText(applied!);
    }
  });
  for (const method of ["Cerrar", "Cancelar", "Escape", "Aplicar"]) {
    test(`${viewport.width}px restores focus after two ${method} cycles and preserves draft/URL`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(custom);
      const original = await trigger(page).elementHandle();
      const url = page.url(), applied = JSON.parse((await page.getByTestId("applied").textContent())!);
      let expected = applied;
      for (let cycle = 0; cycle < 2; cycle++) {
        await trigger(page).click();
        await expect(sheet(page).getByRole("combobox").first()).toHaveText(expected.estatus);
        const next = cycle === 0 ? "Pagada" : "Parcial";
        await editStatus(page, next);
        await expect(page.getByTestId("applied")).toHaveText(JSON.stringify(expected));
        await dismiss(page, method);
        expect(await trigger(page).evaluate((current, previous) => current === previous, original)).toBe(true);
        if (method === "Aplicar") {
          expected = { ...applied, estatus: next, page: 0 };
          await expect(page.getByTestId("applied")).toHaveText(JSON.stringify(expected));
          await expect.poll(() => new URL(page.url()).searchParams.get("estatus")).toBe(next);
          const params = new URL(page.url()).searchParams;
          for (const [key, value] of new URL(url).searchParams) {
            if (!["estatus", "page"].includes(key)) expect(params.get(key)).toBe(value);
          }
        } else {
          await expect(page).toHaveURL(url);
          await expect(page.getByTestId("applied")).toHaveText(JSON.stringify(expected));
        }
      }
      await expect(trigger(page)).toHaveCount(1);
      await expect(trigger(page)).toHaveText(viewport.width < 768 ? "Filtros8" : "Filtros7");
    });
  }
  test(`${viewport.width}px keeps trigger and draft while crossing 768 with panel open`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(custom);
    const original = await trigger(page).elementHandle();
    const url = page.url(), applied = await page.getByTestId("applied").textContent();
    for (let cycle = 0; cycle < 2; cycle++) {
      await trigger(page).click();
      await editStatus(page, "Pagada");
      await page.setViewportSize(viewport.width < 768 ? desktop : mobile);
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page).getByRole("combobox").first()).toHaveText("Pagada");
      await expect(page.getByTestId("applied")).toHaveText(applied!);
      await dismiss(page, "Cancelar");
      expect(await trigger(page).evaluate((current, previous) => current === previous, original)).toBe(true);
      await expect(page).toHaveURL(url);
      await page.setViewportSize(viewport);
    }
  });
}
