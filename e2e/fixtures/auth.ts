/**
 * Fixtures de autenticación para specs E2E.
 *
 * 12.61.20 (Sprint 4): si `e2e/globalSetup.ts` produjo storageState con
 * sesión, `loginAs(...)` detecta la URL post-login y evita reescribir el
 * formulario (ahorra ~3-5s por spec). Si no hay storageState, hace login
 * normal vía formulario.
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

/**
 * Login desde / (formulario unificado). Si ya hay sesión cargada vía
 * storageState, salta el formulario verificando la URL después de `goto`.
 *
 * Regex anclada: `/login` matchea exacto o seguido de `/`, NO `/loginhistory`.
 */
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


