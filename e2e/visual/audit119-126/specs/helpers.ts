import { expect, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";

export async function installNetworkGuards(context: BrowserContext, page: Page) {
  const log = { requests: [] as string[], blocked: [] as string[], errors: [] as string[] };
  page.on("pageerror", error => log.errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") log.errors.push(message.text());
  });
  await context.route("**/*", route => {
    const request = route.request();
    const url = new URL(request.url());
    // Record no query strings, cookies, headers, storage or environment values.
    const description = `${request.method()} ${url.origin}${url.pathname}`;
    log.requests.push(description);
    const isStaticFixture = url.pathname === "/" || url.pathname === "/index.html" || url.pathname.startsWith("/assets/");
    if (url.origin !== "http://127.0.0.1:8096" || request.method() !== "GET" || !isStaticFixture) {
      log.blocked.push(description);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  await context.routeWebSocket(/.*/, socket => {
    log.blocked.push("WebSocket attempt");
    socket.close();
  });
  return log;
}

export async function capture(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage, animations: "disabled", caret: "hide" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

export async function geometry(locator: Locator) {
  return locator.evaluate(element => ({
    rect: element.getBoundingClientRect().toJSON(),
    clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
    overflowY: getComputedStyle(element).overflowY,
  }));
}

export async function expectReachable(control: Locator, page: Page) {
  await control.focus();
  await expect(control).toBeFocused();
  await expect(control).toBeInViewport({ ratio: 1 });
  const bounds = await control.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(-1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  return bounds;
}

export async function checkFocusTrap(page: Page) {
  const order = [];
  for (const key of ["Tab", "Shift+Tab"]) {
    // Five enabled controls: select, textarea, confirmation input, cancel, confirm.
    for (let index = 0; index < 6; index++) {
      await page.keyboard.press(key);
      const focus = await page.evaluate(() => ({
        id: document.activeElement?.id,
        text: document.activeElement?.textContent,
        inside: Boolean(document.activeElement?.closest('[role="alertdialog"]')),
      }));
      order.push({ key, ...focus });
      expect(focus.inside, `${key} focus must stay inside the dialog`).toBe(true);
    }
  }
  return order;
}

export async function checkCards(page: Page) {
  for (const [id, applied] of [["active-card", "USD 1.00"], ["cancelled-card", "USD 0.00"]]) {
    const card = page.getByTestId(id);
    await expect(card.getByText("Monto", { exact: true })).toBeVisible();
    await expect(card.getByText("Aplicado", { exact: true })).toBeVisible();
    await expect(card.locator(".tabular-nums")).toHaveText(["MXN 20.00", applied]);
    const bounds = await geometry(card);
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
    // MoneyCell intentionally truncates narrow values; its tooltip must expose
    // the complete amount and currency, including under 150% text enlargement.
    for (const amount of await card.locator(".tabular-nums").all()) {
      await amount.hover();
      await expect(page.getByRole("tooltip")).toHaveText(await amount.innerText());
      await page.mouse.move(0, 0);
      await expect(page.getByRole("tooltip")).toHaveCount(0);
    }
  }
  await expect(page.getByTestId("cancelled-card").getByText("Anulado", { exact: true })).toBeVisible();
  return page.locator("article").evaluateAll(cards => cards.map(card => ({
    text: card.textContent, horizontalOverflow: card.scrollWidth > card.clientWidth,
    amounts: [...card.querySelectorAll(".tabular-nums")].map(element => ({
      text: element.textContent, clipped: element.scrollWidth > element.clientWidth,
    })),
  })));
}
