import { expect, test } from "@playwright/test";
import { capture, checkCards, checkFocusTrap, expectReachable, geometry, installNetworkGuards } from "./helpers";

test("119/126: currencies, bounded scroll, keyboard cancellation and reset without confirming", async ({ context, page }, testInfo) => {
  const network = await installNetworkGuards(context, page);
  const facts: Record<string, unknown> = {};
  const fontPercent = testInfo.project.metadata.fontPercent;
  const theme = testInfo.project.use.colorScheme;
  try {
    await page.clock.setFixedTime(new Date("2026-10-05T12:00:00-06:00"));
    await page.goto(`/?theme=${theme}&fontPercent=${fontPercent}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByTestId("active-card")).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("font-size", fontPercent === 150 ? "24px" : "16px");
    await expect(page.locator("html")).toHaveClass(theme === "dark" ? "dark" : "");
    await capture(page, testInfo, "cards", true);
    facts.cards = await checkCards(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Open using the keyboard; no click on the financial confirmation action.
    const opener = page.getByRole("button", { name: "Abrir cierre sin pago", exact: true });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog", { name: "Cerrar factura sin pago", exact: true });
    await expect(dialog).toBeVisible();
    const cancel = dialog.getByRole("button", { name: "Volver", exact: true });
    const confirm = dialog.getByRole("button", { name: "Cerrar factura", exact: true });
    await expect(cancel).toBeFocused();
    await expect(confirm).toBeDisabled();
    await capture(page, testInfo, "modal-initial");
    const initial = await geometry(dialog);
    facts.initial = initial;
    expect(initial.rect.y).toBeGreaterThanOrEqual(-1);
    expect(initial.rect.bottom).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
    expect(initial.rect.x).toBeGreaterThanOrEqual(-1);
    expect(initial.rect.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    expect(initial.scrollWidth).toBeLessThanOrEqual(initial.clientWidth + 1);
    expect(initial.overflowY).toBe("auto");

    await dialog.evaluate(element => { element.scrollTop = 0; });
    await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBe(0);
    await capture(page, testInfo, "modal-top");
    if (initial.scrollHeight > initial.clientHeight + 1) {
      await page.mouse.move(initial.rect.x + 5, initial.rect.y + initial.rect.height / 2);
      await page.mouse.wheel(0, page.viewportSize()!.height / 2);
      await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      facts.wheelScroll = await geometry(dialog);
    }
    const typedConfirmation = page.locator("#cxp-cerrar-confirm");
    await expectReachable(typedConfirmation, page);
    await typedConfirmation.fill("CERRAR");
    await expect(confirm).toBeDisabled(); // A reason is still required.

    const reason = page.locator("#cxp-cerrar-motivo");
    await expectReachable(reason, page);
    await page.keyboard.press("Space");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Home");
    await expect(page.getByRole("option", { name: "Compensación", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option", { name: "Condonación", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(reason).toHaveText("Condonación");
    const comment = page.locator("#cxp-cerrar-comentario");
    await expectReachable(comment, page);
    await comment.fill("Comentario ficticio para verificar scroll y cancelación.");
    await expect(confirm).toBeEnabled();
    facts.footer = await expectReachable(confirm, page);
    const bottom = await geometry(dialog);
    facts.bottom = bottom;
    if (bottom.scrollHeight > bottom.clientHeight + 1) expect(bottom.scrollTop).toBeGreaterThan(0);
    await capture(page, testInfo, "modal-footer");
    facts.focusOrder = await checkFocusTrap(page);

    await expectReachable(cancel, page);
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.locator("#fixture-state")).toHaveText("Confirmaciones: 0; cierres: 1");
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(typedConfirmation).toHaveValue("");
    await expect(comment).toHaveValue("");
    await expect(reason).toHaveText("Selecciona un motivo");
    await expect(confirm).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator("#fixture-state")).toHaveText("Confirmaciones: 0; cierres: 2");
    facts.cancelAndEscape = true;
    facts.resetOnReopen = true;
    facts.confirmations = 0;
  } finally {
    await testInfo.attach("audit-diagnostics", {
      body: JSON.stringify({ project: testInfo.project.name, fontPercent, theme, facts, network }, null, 2),
      contentType: "application/json",
    });
    expect.soft(network.blocked, "No non-fixture requests or WebSockets").toEqual([]);
    expect.soft(network.errors, "No browser or console errors").toEqual([]);
  }
});
