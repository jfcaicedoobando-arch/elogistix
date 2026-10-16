import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 720 }, { width: 691, height: 763 }]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`overlay y caché ${viewport.width}x${viewport.height} ${colorScheme}`, async ({ page, context }, info) => {
      const external: string[] = [];
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin === "http://127.0.0.1:8099" && route.request().method() === "GET") return route.continue();
        external.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        return route.abort();
      });
      await context.routeWebSocket(/.*/, socket => { external.push("WebSocket"); socket.close(); });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      await page.goto("/");
      const trigger = page.getByRole("button", { name: "Abrir diálogo" });
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.locator("body")).toHaveCSS("pointer-events", "none");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "Cerrar", exact: true }).click();
      await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
      await trigger.click();
      await page.getByRole("link", { name: "Navegar y desmontar" }).click();
      await expect(page.getByRole("heading", { name: "Ruta de destino" })).toBeVisible();
      await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
      await page.getByRole("link", { name: "Volver a la demo" }).click();
      await page.getByRole("button", { name: "Preparar tasa de hace 2 h" }).click();
      await page.getByRole("button", { name: "Montar tasas", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("consultas: 1");
      await expect(async () => {
        await page.getByRole("button", { name: "Ver snapshot en memoria" }).click();
        await expect(page.getByTestId("snapshot")).toContainText("exchange-rates");
      }).toPass();
      await expect(page.getByTestId("snapshot")).not.toContainText("OPERACION_SINTETICA_NO_PERSISTIR");
      await expect(page.getByTestId("snapshot")).toContainText('"mutations":[]');
      await page.screenshot({ path: info.outputPath("demo.png"), fullPage: true });
      expect(external).toEqual([]);
    });
  }
}
