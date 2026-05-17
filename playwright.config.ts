/**
 * Bloque 2.3 — Configuración de Playwright para E2E críticos.
 *
 * Esta config no se ejecuta como parte del build ni de `npm test` (que sigue
 * siendo vitest). Para correrla:
 *   1) `npm i -D @playwright/test`
 *   2) `npx playwright install chromium`
 *   3) Definir variables de entorno (ver `e2e/README.md`):
 *        E2E_BASE_URL, E2E_EMAIL, E2E_PASSWORD,
 *        E2E_PORTAL_EMAIL, E2E_PORTAL_PASSWORD
 *   4) `npx playwright test`
 *
 * Se mantiene fuera de `tsconfig.app.json` (que sólo incluye `src/`) para
 * que el typecheck del bundle no exija la dependencia.
 */
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // mutaciones contra DB compartida ⇒ serie
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
