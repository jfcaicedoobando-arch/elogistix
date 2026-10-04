/**
 * Configuración Playwright para E2E críticos de Libre Carga.
 *
 * v13.300.23 — Auditoría:
 *   - Paralelismo activado (`fullyParallel: true`, workers configurables).
 *   - Specs mutadores clasificados en fixtures/specGroups agrupados en `chromium-mutators` con
 *     `fullyParallel: false` para preservar el orden y evitar contención
 *     sobre datos compartidos.
 *   - Reporters `junit` + `blob` habilitados en CI para shards.
 *
 * Setup local:
 *   1) `npm i -D @playwright/test`
 *   2) `npx playwright install chromium`
 *   3) Variables de entorno (`.env.e2e` se carga automático si existe):
 *        E2E_BASE_URL, E2E_EMAIL, E2E_PASSWORD,
 *        E2E_PORTAL_EMAIL, E2E_PORTAL_PASSWORD,
 *        E2E_CROSS_ORG_EMBARQUE_ID, E2E_CROSS_ORG_FACTURA_ID, E2E_CROSS_ORG_COTIZACION_ID
 *   4) `npx playwright test`
 */
import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { MUTATOR_SPECS, PORTAL_SPEC, MULTI_TENANT_SPEC, mutatorPattern } from "./e2e/fixtures/specGroups";

const envFile = resolve(process.cwd(), ".env.e2e");
if (existsSync(envFile)) loadDotenv({ path: envFile });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(BASE_URL);

// Workers: CI conservador (2), local agresivo (4). Override con E2E_WORKERS.
const WORKERS = Number(
  process.env.E2E_WORKERS ?? (process.env.CI ? 2 : 4),
);

const reporters: NonNullable<Parameters<typeof defineConfig>[0]["reporter"]> = process.env.CI
  ? [
      ["list"],
      ["html", { open: "never" }],
      ["junit", { outputFile: "test-results/junit.xml" }],
      ...(process.env.E2E_BLOB ? ([["blob"]] as [["blob"]]) : []),
    ]
  : "list";

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: Number.isFinite(WORKERS) && WORKERS > 0 ? WORKERS : 1,
  globalSetup: "./e2e/globalSetup.ts",
  globalTeardown: "./e2e/globalTeardown.ts",
  reporter: reporters,
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
    // Specs read-only internos → paralelo.
    {
      name: "chromium-internal",
      testIgnore: [PORTAL_SPEC, MUTATOR_SPECS, MULTI_TENANT_SPEC],
      fullyParallel: true,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/internal.json",
      },
    },
    // Todos los specs que escriben → serie estricta contra la DB compartida.
    {
      name: "chromium-mutators",
      testMatch: mutatorPattern(process.env.E2E_REQUIRED_FLOWS),
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/internal.json",
      },
    },
    {
      name: "chromium-portal",
      testMatch: PORTAL_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/portal.json",
      },
    },
    // Multi-tenant (26): sin storageState precargado — cada test hace su
    // propio login con las credenciales de la org que le corresponde.
    {
      name: "chromium-multi-tenant",
      testMatch: MULTI_TENANT_SPEC,
      fullyParallel: false,
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
