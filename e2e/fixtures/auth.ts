/**
 * Fixtures de autenticación para specs E2E.
 *
 * v13.300.28 — Añadido `switchUser(page, creds)` para cambios de rol
 * dentro del mismo test sin heredar cookies/tokens del anterior.
 */
import { expect, type Page } from "@playwright/test";

interface Creds {
  email: string;
  password: string;
}

function readCreds(envPrefix: "E2E" | "E2E_PORTAL"): Creds {
  const email = process.env[`${envPrefix}_EMAIL`];
  const password = process.env[`${envPrefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error(
      `Faltan variables de entorno ${envPrefix}_EMAIL / ${envPrefix}_PASSWORD. Ver e2e/README.md.`,
    );
  }
  return { email, password };
}

export const internalCreds = (): Creds => readCreds("E2E");
export const portalCreds = (): Creds => readCreds("E2E_PORTAL");

const LOGIN_PATH_RE = /^\/?$|^\/login(\/|$)/i;

export async function loginAs(page: Page, creds: Creds): Promise<void> {
  await page.goto("/");
  const currentPath = new URL(page.url()).pathname;
  if (!LOGIN_PATH_RE.test(currentPath)) return;

  await page.getByLabel(/correo|email/i).fill(creds.email);
  await page.getByLabel(/contrase/i).fill(creds.password);
  await page.getByRole("button", { name: /iniciar sesión|entrar|ingresar/i }).click();
  await expect(page).not.toHaveURL(LOGIN_PATH_RE, { timeout: 20_000 });
}

/**
 * Reset TOTAL de sesión + login como otro rol. Usar cuando un spec necesita
 * mezclar admin ↔ portal en el mismo test (raro, pero indispensable en 06
 * cross-org y flujos de impersonación).
 *
 * Limpia cookies del contexto y `localStorage` / `sessionStorage` del origen
 * antes de ejecutar `loginAs`, garantizando que Supabase no reutilice el
 * `sb-*-auth-token` del rol anterior.
 */
export async function switchUser(page: Page, creds: Creds): Promise<void> {
  const context = page.context();
  await context.clearCookies();
  // Navegar al origen para poder tocar su storage sin errores.
  await page.goto("/");
  await page
    .evaluate(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        /* origen restringido */
      }
    })
    .catch(() => undefined);
  await loginAs(page, creds);
}
