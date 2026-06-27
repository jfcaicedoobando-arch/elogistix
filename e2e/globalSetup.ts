/**
 * globalSetup para Playwright.
 *
 * Login UNA sola vez por rol y persiste `storageState` en
 * `e2e/.auth/internal.json` y `e2e/.auth/portal.json`. Los projects de
 * `playwright.config.ts` los consumen vía `use.storageState`.
 *
 * Si faltan credenciales para un rol, escribimos un storageState vacío
 * (cookies/origins en []) para que los specs caigan al `loginAs(...)`
 * clásico sin romper.
 */
import { chromium, type FullConfig } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

// Cargar `.env.e2e` si existe (idempotente con playwright.config.ts).
const envFile = resolve(process.cwd(), ".env.e2e");
if (existsSync(envFile)) loadDotenv({ path: envFile });

const AUTH_DIR = "e2e/.auth";
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] }, null, 2);

async function saveStorageState(baseUrl: string, email: string, password: string, file: string) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(baseUrl);
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contrase/i).fill(password);
    await page.getByRole("button", { name: /iniciar sesión|entrar|ingresar/i }).click();
    // Esperar a salir de la pantalla de login.
    await page.waitForURL((url) => !/^\/?$|^\/login(\/|$)/i.test(url.pathname), {
      timeout: 20_000,
    });
    // Y a que el shell autenticado esté hidratado — evita capturar el
    // storageState antes de que Supabase escriba el sb-* token en localStorage.
    await page.getByText(/libre carga/i).first().waitFor({ state: "visible", timeout: 15_000 });
    await ctx.storageState({ path: file });
  } catch (err) {
    // Si el login falla, escribimos un storageState vacío para que los
    // specs caigan al `loginAs(...)` clásico en vez de heredar un estado
    // "logueado" falso que terminaría rompiendo todos los specs.
    
    console.warn(`[globalSetup] login falló para ${email}: ${(err as Error).message}`);
    writeFileSync(file, EMPTY_STATE);
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(_config: FullConfig) {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8080";
  mkdirSync(AUTH_DIR, { recursive: true });

  const internalFile = join(AUTH_DIR, "internal.json");
  const portalFile = join(AUTH_DIR, "portal.json");

  // Internas
  const internal = { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD };
  if (internal.email && internal.password) {
    await saveStorageState(baseUrl, internal.email, internal.password, internalFile);
  } else if (!existsSync(internalFile)) {
    writeFileSync(internalFile, EMPTY_STATE);
  }

  // Portal cliente
  const portal = { email: process.env.E2E_PORTAL_EMAIL, password: process.env.E2E_PORTAL_PASSWORD };
  if (portal.email && portal.password) {
    await saveStorageState(baseUrl, portal.email, portal.password, portalFile);
  } else if (!existsSync(portalFile)) {
    writeFileSync(portalFile, EMPTY_STATE);
  }
}
