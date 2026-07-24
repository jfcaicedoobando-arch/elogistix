/**
 * Flujo 14 — Cotización → Proforma → Facturación responsive.
 *
 * Valida que las rutas del pipeline comercial-a-fiscal sean usables en
 * tableta (768×1024) y escritorio xl+ (1440×900): heading visible, sin
 * overflow horizontal y tabs de facturación accesibles.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

const VIEWPORTS = [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop-xl", width: 1440, height: 900 },
] as const;

const STEPS = [
  { path: "/cotizaciones", heading: /cotizaci/i },
  { path: "/proformas", heading: /proformas/i },
  { path: "/facturacion", heading: /facturaci/i },
] as const;

async function measureOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    return {
      main: main.scrollWidth - main.clientWidth,
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`Flujo 14 — Cotización→Facturación (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`pipeline comercial-a-fiscal sin overflow (${vp.name})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
      });

      await loginAs(page, internalCreds());

      for (const step of STEPS) {
        await page.goto(step.path);
        await expect(page.getByRole("heading", { name: step.heading }).first()).toBeVisible({
          timeout: 15_000,
        });
        await page.waitForLoadState("networkidle").catch(() => {});

        const overflow = await measureOverflow(page);
        expect(overflow.main, `overflow <main> en ${step.path} @ ${vp.name}`).toBeLessThanOrEqual(1);
        expect(overflow.doc, `overflow document en ${step.path} @ ${vp.name}`).toBeLessThanOrEqual(1);
      }

      // Tabs actuales del módulo de facturación: Emitidas + Notas de crédito
      // (Por timbrar migró a KPI en el header).
      await expect(page.getByRole("tab", { name: /emitidas/i }).first()).toBeVisible();
      await expect(page.getByRole("tab", { name: /notas de cr/i }).first()).toBeVisible();

      expect(consoleErrors, `consola en ${vp.name}`).toEqual([]);
    });
  });
}
