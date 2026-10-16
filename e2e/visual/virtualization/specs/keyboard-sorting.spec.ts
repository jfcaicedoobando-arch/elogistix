import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

type Mode = "client" | "server";
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

function focusFacts(button: Locator) {
  return button.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      tag: element.tagName, type: element.getAttribute("type"), tabIndex: element.tabIndex,
      focused: document.activeElement === element, focusVisible: element.matches(":focus-visible"),
      boxShadow: style.boxShadow, outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth, ringShadow: style.getPropertyValue("--tw-ring-shadow"),
    };
  });
}
function rowOrder(page: Page) {
  return page.locator("tbody tr").evaluateAll(rows => rows.map(row =>
    row.querySelector("td")?.textContent?.trim() ?? ""));
}
const originalOrder = ["Zoe", "Ana", "Luis"];
const ascendingOrder = ["Ana", "Luis", "Zoe"];
const descendingOrder = ["Zoe", "Luis", "Ana"];

async function exercise(page: Page, mode: Mode, info: TestInfo) {
  await page.goto(`/?case=keyboard-${mode}`);
  const before = page.getByRole("button", { name: "Antes de la tabla", exact: true });
  const after = page.getByRole("button", { name: "Después de la tabla", exact: true });
  const header = page.getByRole("columnheader", { name: "Name", exact: true });
  const button = header.getByRole("button", { name: "Name", exact: true });
  const detail = page.getByRole("columnheader", { name: "Detail", exact: true });
  const state = page.getByTestId("sort-state");
  await expect(header).toHaveAttribute("aria-sort", "none");
  await expect(detail).not.toHaveAttribute("aria-sort");
  await expect(detail).not.toHaveAttribute("tabindex");
  await expect(detail.getByRole("button")).toHaveCount(0);
  await expect.poll(() => rowOrder(page)).toEqual(originalOrder);
  const unfocused = await focusFacts(button);
  expect(unfocused.tag).toBe("BUTTON");
  expect(unfocused.type).toBe("button");
  expect(unfocused.tabIndex).toBe(0);
  expect(unfocused.focused).toBe(false);
  expect(unfocused.focusVisible).toBe(false);

  // Start from the document and traverse native sequential focus; no focus/click shortcut.
  await page.keyboard.press("Tab");
  await expect(before).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  const keyboardFocused = await focusFacts(button);
  expect(keyboardFocused.focusVisible).toBe(true);
  expect(keyboardFocused.boxShadow).not.toBe("none");
  expect(keyboardFocused.boxShadow).not.toBe(unfocused.boxShadow);
  await info.attach(`${mode}-keyboard-focus-ring`, {
    contentType: "image/png", body: await page.getByTestId("keyboard-fixture").screenshot(),
  });

  const steps = [];
  let calls = 0;
  for (const key of ["Enter", "Space"]) {
    for (const direction of ["ascending", "descending", "none"] as const) {
      await page.keyboard.press(key);
      if (mode === "server") calls += 1;
      await expect(header).toHaveAttribute("aria-sort", direction);
      await expect(button).toBeFocused();
      const expectedOrder = mode === "server" || direction === "none" ? originalOrder
        : direction === "ascending" ? ascendingOrder : descendingOrder;
      await expect.poll(() => rowOrder(page)).toEqual(expectedOrder);
      const expectedState = mode === "client" || direction === "none"
        ? { calls, key: null, dir: "asc" }
        : { calls, key: "name", dir: direction === "ascending" ? "asc" : "desc" };
      await expect(state).toHaveText(JSON.stringify(expectedState));
      const focused = await focusFacts(button);
      expect(focused.focusVisible).toBe(true);
      expect(focused.boxShadow).toBe(keyboardFocused.boxShadow);
      steps.push({ key, direction, order: await rowOrder(page), state: expectedState, focused });
    }
  }

  // Detail is not a tab stop. The next native Tab reaches the button after the table.
  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();
  const blurred = await focusFacts(button);
  expect(blurred.focusVisible).toBe(false);
  expect(blurred.boxShadow).toBe(unfocused.boxShadow);
  await detail.click();
  await expect(button).not.toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(header).toHaveAttribute("aria-sort", "none");
  await expect(detail).not.toHaveAttribute("aria-sort");
  await expect.poll(() => rowOrder(page)).toEqual(originalOrder);
  await expect(state).toHaveText(JSON.stringify({ calls, key: null, dir: "asc" }));
  const negative = { order: await rowOrder(page), state: await state.textContent(), focused: await focusFacts(button) };
  await info.attach(`${mode}-native-keyboard-facts`, {
    contentType: "application/json", body: Buffer.from(JSON.stringify({
      browser: info.project.name, mode, unfocused, keyboardFocused, steps, blurred, negative,
      diagnostics: diagnostics.get(page),
    }, null, 2)),
  });
}

test("client sorting uses native Tab/Enter/Space with a visible focus ring and exact row order", async ({ page }, info) => {
  await exercise(page, "client", info);
});
test("server sorting emits one callback per native Enter/Space and skips the nonsortable header", async ({ page }, info) => {
  await exercise(page, "server", info);
});
