/**
 * globalSetup para Playwright (12.61.20, Sprint 4 D-16).
 *
 * Ejecuta el login UNA sola vez y persiste `storageState` en
 * `e2e/.auth/internal.json` (y `portal.json` si están las creds del portal).
 * Los specs lo consumen mediante `test.use({ storageState: ... })` o vía la
 * config del proyecto.
 *
 * Si las credenciales no están definidas, el setup termina sin error y los
 * specs caen al flujo `loginAs(...)` clásico. De este modo no rompe el modo
 * dev local sin variables.
 */
import { chromium, request as pwRequest, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const AUTH_DIR = "e2e/.auth";

async function saveStorageState(baseUrl: string, email: string, password: string, file: string) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(baseUrl);
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contrase/i).fill(password);
    await page.getByRole("button", { name: /iniciar sesión|entrar|ingresar/i }).click();
    await page.waitForURL((url) => !/\/$|\/login/i.test(url.pathname), { timeout: 20_000 });
    await ctx.storageState({ path: file });
    // Silenciar warning de unused import
    void pwRequest;
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(_config: FullConfig) {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8080";
  mkdirSync(AUTH_DIR, { recursive: true });

  const internal = {
    email: process.env.E2E_EMAIL,
    password: process.env.E2E_PASSWORD,
  };
  if (internal.email && internal.password) {
    await saveStorageState(baseUrl, internal.email, internal.password, join(AUTH_DIR, "internal.json"));
  }

  const portal = {
    email: process.env.E2E_PORTAL_EMAIL,
    password: process.env.E2E_PORTAL_PASSWORD,
  };
  if (portal.email && portal.password) {
    await saveStorageState(baseUrl, portal.email, portal.password, join(AUTH_DIR, "portal.json"));
  }
}
