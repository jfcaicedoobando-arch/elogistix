/**
 * Flujo 19 — Panel Super Admin responsive.
 *
 * Valida rutas `/admin/*` en tableta (768×1024) y desktop xl+ (1440×900):
 *   - `/admin` (dashboard), `/admin/organizaciones`, `/admin/auditoria`,
 *     `/admin/configuracion`.
 *   - `<main>` sin overflow horizontal.
 *   - 0 `console.error`.
 *
 * Si el usuario `E2E_EMAIL` no tiene rol Super Admin, el bloque se salta al
 * detectar redirección fuera de `/admin`.
 */
import { expect, test, type Page } from "../fixtures/testBase";
import { internalCreds, loginAs } from "../fixtures/auth";

const VIEWPORTS = [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop-xl", width: 1440, height: 900 },
] as const;

const RUTAS = [
  { path: "/admin", heading: /(dashboard|super admin)/i, label: "admin dashboard" },
  { path: "/admin/organizaciones", heading: /organizaciones/i, label: "admin organizaciones" },
  { path: "/admin/auditoria", heading: /auditor[ií]a/i, label: "admin auditoría" },
  { path: "/admin/configuracion", heading: /configuraci[oó]n/i, label: "admin configuración" },
] as const;

async function assertNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    return {
      main: main.scrollWidth - main.clientWidth,
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(overflow.main, `overflow <main> en ${label}`).toBeLessThanOrEqual(1);
  expect(overflow.doc, `overflow document en ${label}`).toBeLessThanOrEqual(1);
}

for (const vp of VIEWPORTS) {
  test.describe(`Flujo 19 — Admin (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await loginAs(page, internalCreds());
    });

    test(`Rutas /admin/* sin overflow ni errores (${vp.name})`, async ({ page }) => {
      const errores: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errores.push(m.text().slice(0, 200));
      });

      // Sondeo: si el usuario no es super-admin, la app redirige fuera de /admin.
      await page.goto("/admin");
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      const url = new URL(page.url());
      test.skip(
        !url.pathname.startsWith("/admin"),
        "Usuario E2E sin rol Super Admin — /admin redirige fuera",
      );

      for (const r of RUTAS) {
        await page.goto(r.path);
        await expect(
          page.getByRole("heading", { name: r.heading }).first(),
        ).toBeVisible({ timeout: 15_000 });
        await page.waitForLoadState("networkidle").catch(() => {});
        await assertNoOverflow(page, `${r.label} ${vp.name}`);
      }

      expect(errores, `consola admin ${vp.name}`).toEqual([]);
    });
  });
}
