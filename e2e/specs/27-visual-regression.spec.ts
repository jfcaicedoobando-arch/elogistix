/**
 * Flujo 27 — Regresión visual de componentes clave.
 *
 * Captura y compara pixel-por-pixel tres componentes que concentran gran
 * parte de las regresiones de layout históricas:
 *
 *   1. `TimelineEstadosCard` (Dashboard) — tira horizontal de estados.
 *   2. `GlobalSearch` (Topbar) — trigger + badge ⌘K responsive.
 *   3. `Breadcrumbs` (Topbar) — migas de pan con `aria-label="Migas de pan"`.
 *
 * Cada componente se captura en 3 viewports representativos:
 *
 *   - Mobile   (375 × 812)   — iPhone-ish, banda `sm-`
 *   - Tablet   (768 × 1024)  — iPad vertical, banda `md`
 *   - Desktop  (1440 × 900)  — laptop estándar, banda `xl`
 *
 * ### Cómo actualizar los baselines
 *
 *     npx playwright test 27-visual-regression --update-snapshots
 *
 * ### Máscaras
 *
 * `TimelineEstadosCard` incluye conteos que dependen del estado real de la
 * base; los enmascaramos con `mask` para que el diff sólo evalúe la
 * estructura visual (íconos, gradientes, espaciado). Breadcrumbs y
 * GlobalSearch son estáticos en `/inicio`.
 *
 * v13.301.66 · Nuevo suite Visual Regression.
 */
import { expect, test } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

// Umbral holgado para diferencias mínimas de anti-aliasing entre entornos
// (CI vs local). Si el layout se rompe de verdad, el diff será enorme.
const SCREENSHOT_OPTS = {
  maxDiffPixelRatio: 0.01,
  animations: "disabled" as const,
  caret: "hide" as const,
};

for (const vp of VIEWPORTS) {
  test.describe(`Flujo 27 — Visual regression @visual (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`componentes de layout estables (${vp.name})`, async ({ page }) => {
      await loginAs(page, internalCreds());
      await page.goto("/inicio");

      // Esperar heading + hidratación de widgets del dashboard.
      await expect(
        page.getByRole("heading", { name: /buen(os|as)\s+(d[íi]as|tardes|noches)/i }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      // (v13.312.17) Se retiró el `waitForTimeout(500)` "buffer defensivo";
      // Playwright ya deshabilita animaciones vía `SCREENSHOT_OPTS`.

      // ── 1. Breadcrumbs ──────────────────────────────────────────────
      const breadcrumbs = page.getByRole("navigation", { name: /migas de pan/i }).first();
      await expect(breadcrumbs).toBeVisible();
      await expect(breadcrumbs).toHaveScreenshot(
        `breadcrumbs-${vp.name}.png`,
        SCREENSHOT_OPTS,
      );

      // ── 2. Global search trigger ────────────────────────────────────
      // En mobile la topbar oculta el label "Buscar..." (`hidden sm:inline`)
      // y en <md el badge ⌘K. El baseline por viewport captura ambos casos.
      const searchTrigger = page.getByTestId("global-search-trigger");
      await expect(searchTrigger).toBeVisible();
      await expect(searchTrigger).toHaveScreenshot(
        `global-search-${vp.name}.png`,
        SCREENSHOT_OPTS,
      );

      // ── 3. Timeline de estados ──────────────────────────────────────
      const timeline = page.getByTestId("timeline-estados-card");
      await expect(timeline).toBeVisible();
      // Enmascarar los conteos (números vivos) para que el diff sólo evalúe
      // estructura/estilo, no el dato dinámico. Ola 3 (v13.312.17): pasamos
      // de una máscara CSS frágil (`.text-xl, .text-2xl` — Tailwind reutilizado
      // en toda la app) a un atributo estable `data-e2e-mask="dynamic-count"`
      // aplicado en `TimelineEstadosCard.tsx`.
      await expect(timeline).toHaveScreenshot(`timeline-estados-${vp.name}.png`, {
        ...SCREENSHOT_OPTS,
        mask: [timeline.locator('[data-e2e-mask="dynamic-count"]')],
      });
    });
  });
}
