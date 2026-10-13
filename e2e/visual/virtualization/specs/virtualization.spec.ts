import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

type Kind = "table" | "timeline";
const diagnostics = new WeakMap<Page, string[]>();
test.beforeEach(async ({ context, page }) => {
  const errors: string[] = [];
  diagnostics.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await context.route("**/*", route => {
    const request = route.request();
    const url = new URL(request.url());
    const staticPath = url.pathname === "/" || url.pathname.startsWith("/assets/");
    if (url.origin === "http://127.0.0.1:8098" && request.method() === "GET" && staticPath) {
      return route.continue();
    }
    errors.push(`Blocked request: ${request.method()} ${url.origin}${url.pathname}`);
    return route.abort("blockedbyclient");
  });
  await context.routeWebSocket(/.*/, socket => {
    errors.push("Blocked WebSocket attempt"); socket.close();
  });
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00Z"));
});
test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page), "No backend/network attempts or browser/console errors").toEqual([]);
});

function expectedIds(kind: Kind, filtered: boolean): string[] {
  const indices = Array.from({ length: 240 }, (_, index) => index);
  const ordered = filtered ? indices.filter(index => index % 2 === 0).reverse() : indices;
  return ordered.map(index => `${kind}-${String(index).padStart(3, "0")}`);
}
function scrollport(page: Page, kind: Kind) {
  return kind === "table" ? page.getByTestId("table-scroll")
    : page.getByTestId("timeline-host").locator(":scope > div");
}
async function layout(port: Locator, expected: string[]) {
  return port.evaluate((element, ids) => {
    const viewport = element.getBoundingClientRect();
    const rows = Array.from(element.querySelectorAll<HTMLElement>("[data-index]")).map(row => {
      const marker = row.querySelector<HTMLElement>("[data-row-id]");
      const anchor = row.querySelector<HTMLAnchorElement>('a[href^="/embarques/"]');
      const id = marker?.dataset.rowId ?? anchor?.getAttribute("href")?.split("/").at(-1) ?? "";
      const rect = row.getBoundingClientRect();
      return { id, index: Number(row.dataset.index), top: rect.top, bottom: rect.bottom, height: rect.height };
    }).sort((a, b) => a.index - b.index);
    const issues: string[] = [];
    if (rows.length < 2 || rows.length >= 60) issues.push(`Unexpected mounted count: ${rows.length}`);
    if (new Set(rows.map(row => row.id)).size !== rows.length) issues.push("Duplicate row IDs");
    rows.forEach((row, index) => {
      if (row.id !== ids[row.index]) issues.push(`Stale/misordered ID at ${row.index}: ${row.id}`);
      if (row.height <= 0) issues.push(`Unmeasured row: ${row.id}`);
      const previous = rows[index - 1];
      if (previous) {
        if (row.index !== previous.index + 1) issues.push("Missing adjacent virtual row");
        const gap = row.top - previous.bottom;
        if (gap < -1 || gap > 2) issues.push(`Overlap/gap before ${row.id}: ${gap}`);
      }
    });
    if (rows.length && (rows[0].top > viewport.top + 1 || rows.at(-1)!.bottom < viewport.bottom - 1)) {
      issues.push("Virtual rows leave an uncovered part of the viewport");
    }
    return { issues, rows, scrollTop: element.scrollTop, scrollHeight: element.scrollHeight,
      viewport: { top: viewport.top, bottom: viewport.bottom, height: viewport.height } };
  }, expected);
}
async function assertLayout(port: Locator, expected: string[]) {
  await expect.poll(async () => (await layout(port, expected)).issues).toEqual([]);
  const snapshot = await layout(port, expected);
  expect(Math.max(...snapshot.rows.map(row => row.height)) - Math.min(...snapshot.rows.map(row => row.height)),
    "The real mounted rows have materially different heights").toBeGreaterThan(30);
  return snapshot;
}
async function scrollToEnd(port: Locator, expected: string[]) {
  await expect.poll(async () => {
    // Measured sizes can change the extent while new rows enter the viewport.
    // Re-read the real extent, without mocking or calling virtualizer internals.
    await port.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const snapshot = await layout(port, expected);
    const last = snapshot.rows.find(row => row.id === expected.at(-1));
    return Boolean(last && last.top >= snapshot.viewport.top - 1 && last.bottom <= snapshot.viewport.bottom + 1);
  }).toBe(true);
  return assertLayout(port, expected);
}
async function filterDuringScroll(page: Page, port: Locator) {
  await port.evaluate(async element => {
    for (let frame = 0; frame < 4; frame += 1) {
      element.scrollTop = element.scrollHeight * [0.25, 0.8, 0.4, 0.65][frame];
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    // Change data in the same frame as a large scroll, without remount/reset.
    element.scrollTop = element.scrollHeight * 0.7;
    document.querySelector<HTMLButtonElement>('[data-testid="filter"]')!.click();
  });
  await expect(page.getByTestId("mode")).toHaveText("filtered-reversed");
}
async function exercise(page: Page, kind: Kind, info: TestInfo) {
  await page.goto(`/?case=${kind}`);
  const port = scrollport(page, kind);
  const all = expectedIds(kind, false);
  const filtered = expectedIds(kind, true);
  const initial = await assertLayout(port, all);
  expect(initial.rows[0].id).toBe(all[0]);
  await port.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => port.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const afterWheel = await assertLayout(port, all);
  expect(afterWheel.scrollTop + afterWheel.viewport.height,
    "Wheel scrolling must validate an intermediate position before the final row").toBeLessThan(afterWheel.scrollHeight - 1);
  const bottom = await scrollToEnd(port, all);
  await filterDuringScroll(page, port);
  const changed = await assertLayout(port, filtered);
  const filteredBottom = await scrollToEnd(port, filtered);
  expect(filteredBottom.rows.at(-1)!.id).toBe(filtered.at(-1));
  await port.evaluate(element => { element.scrollTop = 0; });
  await expect.poll(async () => (await layout(port, filtered)).rows[0]?.id).toBe(filtered[0]);
  await assertLayout(port, filtered);
  // Repeat the interrupted flow: restore the complete order, filter again, and remount.
  await page.getByTestId("filter").click();
  await expect(page.getByTestId("mode")).toHaveText("all");
  await assertLayout(port, all);
  await filterDuringScroll(page, port);
  await assertLayout(port, filtered);
  await page.getByTestId("remount").click();
  await expect(page.getByTestId("generation")).toHaveText("1");
  const remounted = await assertLayout(port, filtered);
  expect(remounted.scrollTop).toBe(0);
  expect(remounted.rows[0].id).toBe(filtered[0]);
  const remountedBottom = await scrollToEnd(port, filtered);
  await info.attach(`${kind}-geometry`, { contentType: "application/json", body: Buffer.from(JSON.stringify({
    browser: info.project.name, initial, afterWheel, bottom, changed, filteredBottom, remounted, remountedBottom,
  }, null, 2)) });
  await info.attach(`${kind}-last-row`, { contentType: "image/png", body: await port.screenshot() });
}

test("real useVirtualTableState retains measured rows and IDs through scroll/filter/reorder/remount", async ({ page }, info) => {
  await exercise(page, "table", info);
});
test("real VirtualTimeline retains variable-height entries through scroll/filter/reorder/remount", async ({ page }, info) => {
  await exercise(page, "timeline", info);
});
