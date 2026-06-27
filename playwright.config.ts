/**
 * Configuración Playwright para E2E críticos de Libre Carga.
 *
 * No corre como parte de `npm test` ni del CI por defecto.
 * Setup local:
 *   1) `npm i -D @playwright/test`
 *   2) `npx playwright install chromium`
 *   3) Variables de entorno (`.env.e2e` se carga automático si existe):
 *        E2E_BASE_URL, E2E_EMAIL, E2E_PASSWORD,
 *        E2E_PORTAL_EMAIL, E2E_PORTAL_PASSWORD,
 *        E2E_CROSS_ORG_EMBARQUE_ID, E2E_CROSS_ORG_FACTURA_ID, E2E_CROSS_ORG_COTIZACION_ID
 *   4) `npx playwright test`
 *
 * Vive fuera de `tsconfig.app.json` para no exigir la dependencia al bundle.
 */
import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

// Carga `.env.e2e` si existe (no rompe si falta — el usuario puede exportar).
const envFile = resolve(process.cwd(), ".env.e2e");
if (existsSync(envFile)) loadDotenv({ path: envFile });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(BASE_URL);

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // mutaciones contra DB compartida ⇒ serie
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // globalSetup hace login una vez y persiste storageState en e2e/.auth/*.json.
  // Los projects de abajo lo consumen vía `use.storageState`.
  globalSetup: "./e2e/globalSetup.ts",
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Levanta el dev server sólo cuando apuntamos a localhost. En remoto (staging)
  // no toca nada. `reuseExistingServer` evita un segundo proceso si ya corre.
  webServer: IS_LOCAL
    ? {
        command: "bun run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
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
      name: "chromium-internal",
      testIgnore: /05-portal\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/internal.json",
      },
    },
    {
      name: "chromium-portal",
      testMatch: /05-portal\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/portal.json",
      },
    },
  ],
});
