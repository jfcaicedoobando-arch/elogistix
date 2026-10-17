import { expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

export async function installNetworkGuards(context: BrowserContext, page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-17T12:00:00Z"));
  const log = { requests: [] as string[], blocked: [] as string[], errors: [] as string[] };
  page.on("pageerror", error => log.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") log.errors.push(message.text()); });
  await context.route("**/*", route => {
    const request = route.request();
    const url = new URL(request.url());
    const description = `${request.method()} ${url.origin}${url.pathname}`;
    log.requests.push(description);
    const isStatic = url.pathname === "/" || url.pathname === "/index.html" || url.pathname.startsWith("/assets/");
    if (url.origin !== "http://127.0.0.1:8097" || request.method() !== "GET" || !isStatic) {
      log.blocked.push(description);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  await context.routeWebSocket(/.*/, socket => { log.blocked.push("WebSocket attempt"); socket.close(); });
  return log;
}

export async function capture(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage, animations: "disabled", caret: "hide" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

export async function assertIsolation(log: Awaited<ReturnType<typeof installNetworkGuards>>, testInfo: TestInfo, facts: unknown = {}) {
  await testInfo.attach("assertions-network", { body: JSON.stringify({ facts, network: log }, null, 2), contentType: "application/json" });
  expect(log.blocked, "No external/mutation/WebSocket attempts").toEqual([]);
  expect(log.errors, "No browser or console errors").toEqual([]);
}
