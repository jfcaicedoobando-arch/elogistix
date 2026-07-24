/**
 * Flujo 13 — Dashboard responsive.
 *
 * Verifica que `/inicio` sea usable tanto en tableta (768×1024) como en
 * escritorio xl+ (1440×900): sin overflow horizontal en `<main>`, heading
 * visible y sin errores de consola.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

const VIEWPORTS = [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop-xl", width: 1440, height: 900 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Flujo 13 — Dashboard (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`/inicio renderiza sin overflow ni errores (${vp.name})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
      });

      await loginAs(page, internalCreds());
      await page.goto("/inicio");

      // El heading del dashboard es un saludo horario ("Buenas tardes…").
      await expect(
        page.getByRole("heading", { name: /buen(os|as)\s+(d[íi]as|tardes|noches)/i }).first(),
      ).toBeVisible({ timeout: 15_000 });

      // Esperar hidratación de widgets/KPIs.
      await page.waitForLoadState("networkidle").catch(() => {});

      const overflow = await page.evaluate(() => {
        const main = document.querySelector("main") ?? document.body;
        return {
          main: main.scrollWidth - main.clientWidth,
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      expect(overflow.main, `overflow <main> en ${vp.name}`).toBeLessThanOrEqual(1);
      expect(overflow.doc, `overflow document en ${vp.name}`).toBeLessThanOrEqual(1);
      expect(consoleErrors, `consola en ${vp.name}`).toEqual([]);
    });
  });
}
